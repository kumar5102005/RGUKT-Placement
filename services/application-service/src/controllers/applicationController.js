import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import Application, { STANDARD_STAGES, PLACEMENT_STATUSES } from '../models/Application.js';
import StageConfig from '../models/StageConfig.js';

const COMPANY_DRIVE_SERVICE_URL =
  process.env.COMPANY_DRIVE_SERVICE_URL || 'http://company-drive-service:4003';
const NOTIFICATION_SERVICE_URL =
  process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005';
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;
const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || 'http://student-service:4002';

function getUserId(user) {
  return user?.userId || user?.id || user?._id;
}

async function getRecruiterCompanyId(userId) {
  if (!SERVICE_API_KEY) {
    const error = new Error('SERVICE_API_KEY is not configured for company membership checks.');
    error.statusCode = 503;
    error.code = 'SERVICE_CONFIGURATION_ERROR';
    throw error;
  }
  const response = await fetch(
    `${COMPANY_DRIVE_SERVICE_URL}/api/v1/jobs/internal/recruiters/${encodeURIComponent(userId)}/company`,
    { headers: { 'x-service-key': SERVICE_API_KEY } }
  );
  const result = await response.json();
  if (!response.ok || !result.success || !result.data?.companyId) {
    const error = new Error(result.error?.message || 'Unable to verify recruiter company membership.');
    error.statusCode = response.status || 502;
    error.code = result.error?.code || 'COMPANY_MEMBERSHIP_CHECK_FAILED';
    throw error;
  }
  return String(result.data.companyId);
}

async function getApplicationRecruitmentAccess(application, userId) {
  if (!SERVICE_API_KEY) {
    const error = new Error('SERVICE_API_KEY is not configured for company access checks.');
    error.statusCode = 503;
    error.code = 'SERVICE_CONFIGURATION_ERROR';
    throw error;
  }
  const response = await fetch(
    `${COMPANY_DRIVE_SERVICE_URL}/api/v1/jobs/internal/${encodeURIComponent(application.jobId)}/recruitment-access/${encodeURIComponent(userId)}`,
    { headers: { 'x-service-key': SERVICE_API_KEY } }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    const error = new Error(result.error?.message || 'Unable to verify company access for this application.');
    error.statusCode = response.status || 502;
    error.code = result.error?.code || 'COMPANY_ACCESS_CHECK_FAILED';
    throw error;
  }
  return {
    companyId: String(result.data.companyId),
    canView: Boolean(result.data.canView),
    canManage: Boolean(result.data.canManage),
  };
}

async function validateStudentResumeReference(studentUserId, { documentId, fileName }) {
  const query = documentId
    ? `documentId=${encodeURIComponent(documentId)}`
    : `fileName=${encodeURIComponent(fileName)}`;
  const response = await fetch(
    `${STUDENT_SERVICE_URL}/api/v1/students/internal/${encodeURIComponent(studentUserId)}/resume-reference?${query}`,
    { headers: { 'x-service-key': SERVICE_API_KEY } }
  );
  let result;
  try {
    result = await response.json();
  } catch {
    const error = new Error('Student Service returned an invalid resume validation response.');
    error.statusCode = 502;
    error.code = 'RESUME_VALIDATION_FAILED';
    throw error;
  }
  if (!response.ok || !result.success) {
    const isServiceFailure = response.status >= 500;
    const error = new Error(isServiceFailure
      ? 'Unable to validate your selected resume. Please try again.'
      : 'Your selected resume is no longer available. Upload it again before applying.');
    error.statusCode = isServiceFailure ? 502 : 422;
    error.code = isServiceFailure ? 'RESUME_VALIDATION_FAILED' : 'RESUME_UNAVAILABLE';
    throw error;
  }
  if (
    String(result.data?.ownerUserId) !== String(studentUserId) ||
    !result.data?.documentId ||
    !result.data?.storageKey
  ) {
    const error = new Error('Student Service returned an invalid resume ownership reference.');
    error.statusCode = 502;
    error.code = 'RESUME_VALIDATION_FAILED';
    throw error;
  }
  return result.data;
}

async function notifyApplicationStatus(application, type, message, changedBy) {
  let warning = null;
  try {
    if (!SERVICE_API_KEY) throw new Error('SERVICE_API_KEY is not configured for notification delivery.');
    const eventId = createHash('sha256')
      .update(`${application._id}:${type}:${application.updatedAt?.toISOString() || Date.now()}`)
      .digest('hex');
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notifications/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': SERVICE_API_KEY,
      },
      body: JSON.stringify({
        eventId,
        userId: application.studentUserId,
        type,
        title: 'Application status updated',
        message,
        payload: { applicationId: application._id, stage: application.stage, changedBy },
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error?.message || `Notification service returned ${response.status}.`);
    }
    return { delivered: true };
  } catch (error) {
    warning = error.message;
    console.error('Application status notification failed', {
      applicationId: String(application._id),
      error: warning,
    });
    return { delivered: false, warning };
  }
}

async function authorizeApplicationReader(application, user, res) {
  const userId = String(getUserId(user) || '');
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STUDENT') {
    if (application.studentUserId === userId) return true;
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied to this application.' },
    });
    return false;
  }
  if (user.role !== 'RECRUITER') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied to this application.' },
    });
    return false;
  }
  const access = await getApplicationRecruitmentAccess(application, userId);
  if (!access.canView || access.companyId !== String(application.companyId)) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Access denied to this application.' },
    });
    return false;
  }
  return true;
}

async function authorizeApplicationDecision(application, user, res) {
  if (user.role !== 'RECRUITER') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only authorized company recruiters can change recruitment decisions.' },
    });
    return false;
  }
  const access = await getApplicationRecruitmentAccess(application, String(getUserId(user) || ''));
  if (!access.canManage || access.companyId !== String(application.companyId)) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to manage this company recruitment pipeline.' },
    });
    return false;
  }
  return true;
}

// ─── Student Operations ─────────────────────────────────────────────────────

/**
 * POST /api/v1/applications
 * Submit an application for a job.
 * Access: STUDENT
 */
export async function applyForJob(req, res) {
  try {
    const studentUserId = getUserId(req.user);
    const { jobId, coverLetter = '' } = req.body;

    if (!jobId || !mongoose.isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_JOB_ID', message: 'A valid job ID is required.' },
      });
    }

    const existing = await Application.findOne({
      jobId,
      studentUserId,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_APPLICATION',
          message: 'You have already submitted an application for this job posting.',
          data: { application: existing },
        },
      });
    }

    if (!SERVICE_API_KEY) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_CONFIGURATION_ERROR', message: 'Eligibility service authorization is not configured.' },
      });
    }

    const eligibilityResponse = await fetch(
      `${COMPANY_DRIVE_SERVICE_URL}/api/v1/jobs/internal/${encodeURIComponent(jobId)}/check-eligibility`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': SERVICE_API_KEY,
        },
        body: JSON.stringify({ studentUserId }),
      }
    );
    const eligibilityResult = await eligibilityResponse.json();
    if (!eligibilityResponse.ok || !eligibilityResult.success) {
      return res.status(eligibilityResponse.status || 502).json({
        success: false,
        error: eligibilityResult.error || {
          code: 'ELIGIBILITY_SERVICE_ERROR',
          message: 'Unable to verify job or student eligibility.',
        },
      });
    }

    const { job, student, evaluation } = eligibilityResult.data;
    if (String(student?.userId || '') !== String(studentUserId || '')) {
      return res.status(502).json({
        success: false,
        error: {
          code: 'STUDENT_RECORD_MISMATCH',
          message: 'The student record could not be verified for this application.',
        },
      });
    }
    if (job.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: { code: 'JOB_NOT_OPEN', message: 'This job is not currently accepting applications.' },
      });
    }

    const deadline = job.applicationDeadline ? new Date(job.applicationDeadline) : null;
    if (!deadline || Number.isNaN(deadline.getTime()) || Date.now() > deadline.getTime()) {
      return res.status(400).json({
        success: false,
        error: { code: 'DEADLINE_EXPIRED', message: 'The application deadline has passed or is invalid.' },
      });
    }

    if (evaluation.status !== 'ELIGIBLE') {
      return res.status(422).json({
        success: false,
        error: {
          code: evaluation.status === 'INSUFFICIENT_DATA'
            ? 'INSUFFICIENT_ELIGIBILITY_DATA'
            : 'INELIGIBLE_FOR_JOB',
          message: evaluation.status === 'INSUFFICIENT_DATA'
            ? 'Complete the required academic information before applying.'
            : 'You do not satisfy the academic eligibility requirements for this job.',
          details: evaluation.reasons,
          data: { evaluation },
        },
      });
    }

    const selectedResumeDocumentId = student.resumeDocumentId || '';
    const selectedResumeFileName = student.resumeStorageKey || student.resumeFileName || '';
    if (!selectedResumeDocumentId && !selectedResumeFileName) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'RESUME_REQUIRED',
          message: 'Upload a resume before applying for this job.',
        },
      });
    }
    const resumeSnapshot = await validateStudentResumeReference(studentUserId, {
      documentId: selectedResumeDocumentId,
      fileName: selectedResumeFileName,
    });

    const initialHistory = [
      {
        stage: 'Applied',
        changedBy: studentUserId,
        changedByRole: 'STUDENT',
        changedAt: new Date(),
        comments: 'Application submitted successfully by candidate.',
      },
    ];

    const skills = [
      ...(Array.isArray(student.technicalSkills) ? student.technicalSkills : []),
      ...(Array.isArray(student.nonTechnicalSkills) ? student.nonTechnicalSkills : []),
    ];
    const application = new Application({
      jobId,
      jobTitle: job.title,
      companyId: job.companyId,
      companyName: job.companyName,
      studentUserId,
      studentId: student.studentId,
      studentName: student.fullName,
      studentEmail: student.email,
      branch: student.branch,
      btechCgpa: Number(student.btechCgpa),
      activeBacklogs: Number(student.activeBacklogs),
      batchYear: Number(student.batchYear),
      resumeUrl: '',
      resumeFileName: resumeSnapshot.storageKey,
      resumeDocumentId: resumeSnapshot.documentId,
      resumeStorageKey: resumeSnapshot.storageKey,
      resumeOriginalName: resumeSnapshot.originalName,
      resumeMimeType: resumeSnapshot.mimeType,
      resumeSnapshotAt: new Date(),
      skills,
      recruitmentRounds: job.selectionRounds || [],
      coverLetter: coverLetter || '',
      stage: 'Applied',
      finalPlacementStatus: 'PENDING',
      history: initialHistory,
    });

    if (application.resumeDocumentId) {
      application.resumeUrl = `/api/v1/applications/${application._id}/resume`;
    }
    await application.save();

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully! Your application is now Under Review.',
      data: { application },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_APPLICATION', message: 'You have already applied for this job.' },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

export async function syncJobRecruitmentRounds(req, res) {
  try {
    const { jobId } = req.params;
    const { jobTitle, companyName, rounds } = req.body;
    if (!mongoose.isValidObjectId(jobId) || !Array.isArray(rounds)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_RECRUITMENT_ROUNDS', message: 'A valid job ID and rounds array are required.' },
      });
    }

    const normalizedRounds = rounds.map((round) => ({
      roundNumber: Number(round.roundNumber),
      name: String(round.name || '').trim(),
      description: round.description || '',
      mode: round.mode || 'Online',
      scheduledDate: round.scheduledDate || null,
      durationMinutes: round.durationMinutes ?? null,
      venueOrLink: round.venueOrLink || '',
      status: round.status || 'PLANNED',
    }));
    const applications = await Application.find({ jobId }).select(
      '_id studentUserId recruitmentRounds'
    );
    const pendingUpdates = applications.map((application) => {
      const currentRounds = application.recruitmentRounds.map((round) => ({
        roundNumber: round.roundNumber,
        name: round.name,
        description: round.description || '',
        mode: round.mode,
        scheduledDate: round.scheduledDate || null,
        durationMinutes: round.durationMinutes ?? null,
        venueOrLink: round.venueOrLink || '',
        status: round.status || 'PLANNED',
      }));
      return {
        application,
        roundsChanged: JSON.stringify(currentRounds) !== JSON.stringify(normalizedRounds),
      };
    }).filter(({ roundsChanged }) => roundsChanged);

    if (pendingUpdates.length > 0) {
      if (!SERVICE_API_KEY) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'SERVICE_CONFIGURATION_ERROR',
            message: 'Notification service authorization is not configured.',
          },
        });
      }

      const batchId = createHash('sha256')
        .update(`${jobId}:${JSON.stringify(normalizedRounds)}`)
        .digest('hex');
      for (const { application } of pendingUpdates) {
        const eventId = createHash('sha256')
          .update(`${batchId}:${application.studentUserId}`)
          .digest('hex');
        const notificationResponse = await fetch(
          `${NOTIFICATION_SERVICE_URL}/api/v1/notifications/internal`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': SERVICE_API_KEY,
            },
            body: JSON.stringify({
              eventId,
              userId: application.studentUserId,
              type: 'RECRUITMENT_ROUND_UPDATED',
              title: 'Recruitment process updated',
              message: `The recruitment rounds for ${jobTitle || 'a job you applied for'} have changed.`,
              payload: { jobId, jobTitle, companyName, rounds: normalizedRounds },
            }),
          }
        );
        const notificationResult = await notificationResponse.json();
        if (!notificationResponse.ok || !notificationResult.success) {
          return res.status(notificationResponse.status || 502).json({
            success: false,
            error: notificationResult.error || {
              code: 'NOTIFICATION_DELIVERY_FAILED',
              message: 'Unable to notify all applicants about the recruitment round update.',
            },
          });
        }
      }
    }

    const updateResult = await Application.updateMany(
      { _id: { $in: pendingUpdates.map(({ application }) => application._id) } },
      {
        $set: {
          recruitmentRounds: normalizedRounds,
          ...(jobTitle ? { jobTitle } : {}),
          ...(companyName ? { companyName } : {}),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Recruitment rounds synchronized with applications.',
      data: {
        updatedApplications: updateResult.modifiedCount,
        notifiedApplicants: pendingUpdates.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: 'RECRUITMENT_ROUND_SYNC_FAILED', message: error.message },
    });
  }
}

/**
 * GET /api/v1/applications/my
 * View all applications submitted by the current logged-in student.
 * Access: STUDENT
 */
export async function getMyApplications(req, res) {
  try {
    const studentUserId = getUserId(req.user);

    const applications = await Application.find({ studentUserId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { applications, count: applications.length },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

// ─── Recruiter & Admin Management Operations ────────────────────────────────

/**
 * GET /api/v1/applications
 * List and filter applications.
 * Access: RECRUITER (for their company) or ADMIN (all applications).
 */
export async function getApplications(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      jobId,
      companyId,
      stage,
      branch,
      minCgpa,
      placementStatus,
      q,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Recruiters can only access applications for their own company
    if (req.user?.role === 'RECRUITER') {
      query.companyId = await getRecruiterCompanyId(String(getUserId(req.user) || ''));
    } else if (companyId) {
      query.companyId = companyId;
    }

    if (jobId) query.jobId = jobId;
    if (stage) query.stage = stage;
    if (placementStatus) query.finalPlacementStatus = placementStatus;
    if (branch) query.branch = branch.toUpperCase();
    if (minCgpa) query.btechCgpa = { $gte: Number(minCgpa) };

    if (q) {
      query.$or = [
        { studentName: { $regex: q, $options: 'i' } },
        { studentId: { $regex: q, $options: 'i' } },
        { studentEmail: { $regex: q, $options: 'i' } },
        { jobTitle: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } },
      ];
    }

    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [applications, total] = await Promise.all([
      Application.find(query)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Application.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        applications,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/applications/:id
 * Retrieve a specific application record with interview rounds and audit history.
 * Access: Authenticated (Owner student, Recruiter for company, or Admin).
 */
export async function getApplicationById(req, res) {
  try {
    const application = await Application.findById(req.params.id).lean();

    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
      });
    }

    if (!(await authorizeApplicationReader(application, req.user, res))) return;

    return res.status(200).json({
      success: true,
      data: { application },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid application ID.' },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

export async function getApplicationResume(req, res) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid application ID.' },
      });
    }

    const application = await Application.findById(req.params.id).lean();
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
      });
    }
    try {
      if (!(await authorizeApplicationReader(application, req.user, res))) return;
    } catch (error) {
      if (req.user?.role !== 'RECRUITER' || error.code !== 'JOB_NOT_FOUND') {
        throw error;
      }

      const recruiterCompanyId = await getRecruiterCompanyId(String(getUserId(req.user) || ''));
      if (recruiterCompanyId !== String(application.companyId)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied to this application.' },
        });
      }
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_JOB_UNAVAILABLE',
          message: 'The job associated with this application is no longer available.',
        },
      });
    }

    const legacyUrlFileName = /^\/uploads\/resumes\/([A-Za-z0-9._-]+)$/.exec(application.resumeUrl || '')?.[1] || '';
    const fileName = application.resumeStorageKey || application.resumeFileName || legacyUrlFileName;
    const documentId = application.resumeDocumentId || '';
    if (!documentId && !fileName) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_RESUME_UNAVAILABLE',
          message: 'The original submitted document is unavailable; this application has no recoverable resume reference.',
        },
      });
    }
    if (!SERVICE_API_KEY) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_CONFIGURATION_ERROR', message: 'Resume service authorization is not configured.' },
      });
    }

    const studentResumeUrl = `${STUDENT_SERVICE_URL}/api/v1/students/internal/${encodeURIComponent(application.studentUserId)}/resume`;
    const resumeQuery = documentId
      ? `documentId=${encodeURIComponent(documentId)}`
      : `fileName=${encodeURIComponent(fileName)}`;
    const serviceHeaders = { 'x-service-key': SERVICE_API_KEY };
    const response = await fetch(
      `${studentResumeUrl}?${resumeQuery}`,
      { headers: serviceHeaders }
    );

    if (!response.ok) {
      const body = await response.text();
      let errorPayload;
      try {
        errorPayload = JSON.parse(body);
      } catch {
        errorPayload = null;
      }
      return res.status(response.status).json(errorPayload || {
        success: false,
        error: { code: 'RESUME_SERVICE_ERROR', message: 'Unable to retrieve the application resume.' },
      });
    }

    const contentType = response.headers.get('content-type') || application.resumeMimeType || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition') ||
      `attachment; filename="${encodeURIComponent(application.resumeOriginalName || fileName)}"`;
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return Readable.fromWeb(response.body).pipe(res);
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'RESUME_READ_FAILED', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/applications/:id/stage
 * Advance or transition application stage.
 * Lifecycle: Applied -> Under Review -> Shortlisted -> Interview Scheduled -> Selected / Rejected
 * Access: RECRUITER or ADMIN
 */
export async function updateApplicationStage(req, res) {
  try {
    const { stage, customStage, comments = '' } = req.body;
    const userId = getUserId(req.user);
    const userRole = req.user.role;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
      });
    }
    if (!(await authorizeApplicationDecision(application, req.user, res))) return;

    const previousStage = application.stage;
    application.stage = stage;
    if (customStage) application.customStage = customStage;

    // Automatic placement status update based on terminal stages
    if (stage === 'Selected') {
      application.finalPlacementStatus = 'OFFERED';
    } else if (stage === 'Rejected') {
      application.finalPlacementStatus = 'REJECTED';
    }

    // Record transition in history timeline
    application.history.push({
      stage: customStage || stage,
      changedBy: userId,
      changedByRole: userRole,
      changedAt: new Date(),
      comments: comments || `Stage transitioned from '${previousStage}' to '${stage}'.`,
    });

    await application.save();
    const notification = await notifyApplicationStatus(
      application,
      'APPLICATION_STATUS_CHANGED',
      `Your application for ${application.jobTitle} is now ${application.stage}.`,
      userId
    );

    return res.status(200).json({
      success: true,
      message: `Candidate stage successfully updated to '${stage}'.`,
      data: { application, notification },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/v1/applications/:id/interviews
 * Schedule an interview round for the candidate.
 * Automatically updates stage to 'Interview Scheduled'.
 * Access: RECRUITER or ADMIN
 */
export async function scheduleInterview(req, res) {
  try {
    const {
      roundNumber,
      roundName,
      roundType,
      scheduledAt,
      durationMinutes,
      mode,
      meetingLinkOrVenue,
      interviewerPanel,
      instructions,
      comments = '',
    } = req.body;

    const userId = getUserId(req.user);
    const userRole = req.user.role;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
      });
    }
    if (!(await authorizeApplicationDecision(application, req.user, res))) return;

    const interviewData = {
      roundNumber: Number(roundNumber),
      roundName: roundName.trim(),
      roundType: roundType || 'TECHNICAL',
      scheduledAt: new Date(scheduledAt),
      durationMinutes: durationMinutes ? Number(durationMinutes) : 60,
      mode: mode || 'ONLINE',
      meetingLinkOrVenue: meetingLinkOrVenue || '',
      interviewerPanel: Array.isArray(interviewerPanel) ? interviewerPanel : [],
      instructions: instructions || '',
      status: 'SCHEDULED',
      result: 'PENDING',
    };

    const existingRoundIndex = application.interviews.findIndex(
      (r) => r.roundNumber === Number(roundNumber)
    );

    if (existingRoundIndex >= 0) {
      application.interviews[existingRoundIndex] = interviewData;
    } else {
      application.interviews.push(interviewData);
      application.interviews.sort((a, b) => a.roundNumber - b.roundNumber);
    }

    // Advance stage to 'Interview Scheduled'
    application.stage = 'Interview Scheduled';

    // Append to timeline history
    application.history.push({
      stage: 'Interview Scheduled',
      changedBy: userId,
      changedByRole: userRole,
      changedAt: new Date(),
      comments: comments || `Scheduled Round ${roundNumber}: ${roundName} on ${new Date(scheduledAt).toLocaleString()}.`,
    });

    await application.save();
    const notification = await notifyApplicationStatus(
      application,
      'APPLICATION_STATUS_CHANGED',
      `An interview round was scheduled for your application to ${application.jobTitle}.`,
      userId
    );

    return res.status(200).json({
      success: true,
      message: `Interview Round ${roundNumber} scheduled successfully.`,
      data: { application, notification },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/applications/:id/interviews/:roundNumber/evaluation
 * Record interview assessment score, feedback, and result.
 * Access: RECRUITER or ADMIN
 */
export async function submitInterviewEvaluation(req, res) {
  try {
    const { roundNumber } = req.params;
    const { result, score, feedback, advanceStage } = req.body;
    const userId = getUserId(req.user);
    const userRole = req.user.role;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
      });
    }
    if (!(await authorizeApplicationDecision(application, req.user, res))) return;

    const round = application.interviews.find((r) => r.roundNumber === Number(roundNumber));
    if (!round) {
      return res.status(404).json({
        success: false,
        error: { code: 'ROUND_NOT_FOUND', message: `Interview round ${roundNumber} not found.` },
      });
    }

    round.result = result; // PASSED, FAILED, ON_HOLD
    round.status = 'COMPLETED';
    if (score !== undefined) round.score = Number(score);
    if (feedback !== undefined) round.feedback = feedback;
    round.evaluatedBy = req.user.fullName || userId;
    round.evaluatedAt = new Date();

    let historyComment = `Round ${roundNumber} evaluation recorded: ${result}`;
    if (score !== undefined) historyComment += ` (Score: ${score})`;

    // Optionally advance stage if specified or if result is FAILED
    if (result === 'FAILED') {
      application.stage = 'Rejected';
      application.finalPlacementStatus = 'REJECTED';
      historyComment += ` -> Candidate rejected following Round ${roundNumber}.`;
    } else if (advanceStage && STANDARD_STAGES.includes(advanceStage)) {
      application.stage = advanceStage;
      if (advanceStage === 'Selected') application.finalPlacementStatus = 'OFFERED';
      historyComment += ` -> Candidate advanced to '${advanceStage}'.`;
    }

    application.history.push({
      stage: application.stage,
      changedBy: userId,
      changedByRole: userRole,
      changedAt: new Date(),
      comments: historyComment,
    });

    await application.save();
    const notification = await notifyApplicationStatus(
      application,
      'APPLICATION_STATUS_CHANGED',
      `Your recruitment progress for ${application.jobTitle} was updated to ${application.stage}.`,
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'Interview round evaluation submitted.',
      data: { application, notification },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/applications/:id/offer
 * Update final placement status and offer details.
 * Access: RECRUITER or ADMIN
 */
export async function updatePlacementOffer(req, res) {
  try {
    const {
      finalPlacementStatus,
      offeredPackageLpa,
      joiningDate,
      offerLetterUrl,
      validUntil,
      remarks,
    } = req.body;

    const userId = getUserId(req.user);
    const userRole = req.user.role;

    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: { code: 'APPLICATION_NOT_FOUND', message: 'Application not found.' },
      });
    }
    if (!(await authorizeApplicationDecision(application, req.user, res))) return;

    if (finalPlacementStatus && PLACEMENT_STATUSES.includes(finalPlacementStatus)) {
      application.finalPlacementStatus = finalPlacementStatus;
      if (finalPlacementStatus === 'OFFERED' || finalPlacementStatus === 'ACCEPTED') {
        application.stage = 'Selected';
      } else if (finalPlacementStatus === 'REJECTED') {
        application.stage = 'Rejected';
      }
    }

    application.offerDetails = {
      offeredPackageLpa: offeredPackageLpa !== undefined ? Number(offeredPackageLpa) : application.offerDetails?.offeredPackageLpa || 0,
      joiningDate: joiningDate ? new Date(joiningDate) : application.offerDetails?.joiningDate,
      offerLetterUrl: offerLetterUrl || application.offerDetails?.offerLetterUrl || '',
      offerIssuedAt: new Date(),
      validUntil: validUntil ? new Date(validUntil) : application.offerDetails?.validUntil,
      remarks: remarks || '',
    };

    application.history.push({
      stage: application.stage,
      changedBy: userId,
      changedByRole: userRole,
      changedAt: new Date(),
      comments: `Placement offer updated. Status: '${application.finalPlacementStatus}'. Package: ${application.offerDetails.offeredPackageLpa} LPA.`,
    });

    await application.save();
    const notification = await notifyApplicationStatus(
      application,
      'APPLICATION_STATUS_CHANGED',
      `The placement decision for your ${application.jobTitle} application is ${application.finalPlacementStatus}.`,
      userId
    );

    return res.status(200).json({
      success: true,
      message: 'Placement offer updated successfully.',
      data: { application, notification },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

// ─── Stage Configuration (Admin Customizable) ──────────────────────────────

/**
 * GET /api/v1/applications/stages
 * Retrieve standard and custom workflow stages.
 */
export async function getWorkflowStages(req, res) {
  try {
    const customStages = await StageConfig.find({ isActive: true }).sort({ order: 1 }).lean();

    return res.status(200).json({
      success: true,
      data: {
        standardStages: STANDARD_STAGES,
        customStages,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/v1/applications/stages
 * Configure a custom workflow stage.
 * Access: ADMIN
 */
export async function createCustomStage(req, res) {
  try {
    const { name, order, description, color } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'NAME_REQUIRED', message: 'Stage name is required.' },
      });
    }

    const stage = new StageConfig({
      name: name.trim(),
      order: order ? Number(order) : 10,
      description: description || '',
      color: color || 'indigo',
    });

    await stage.save();

    return res.status(201).json({
      success: true,
      message: 'Custom recruitment workflow stage configured.',
      data: { stage },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { code: 'STAGE_EXISTS', message: 'Stage with this name already exists.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}
