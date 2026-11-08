import mongoose from 'mongoose';
import Application, { STANDARD_STAGES, PLACEMENT_STATUSES } from '../models/Application.js';
import StageConfig from '../models/StageConfig.js';

function getUserId(user) {
  return user?.userId || user?.id || user?._id;
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
    const {
      jobId,
      jobTitle,
      companyId,
      companyName,
      studentData = {},
      coverLetter,
      eligibilityRules = {},
      applicationDeadline,
    } = req.body;

    if (!jobId || !jobTitle || !companyId || !companyName) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Job ID, Title, Company ID and Name are required.' },
      });
    }

    // 1. Check Deadline
    if (applicationDeadline) {
      const deadline = new Date(applicationDeadline);
      if (Date.now() > deadline.getTime()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DEADLINE_EXPIRED',
            message: `The application deadline (${deadline.toLocaleDateString()}) has passed.`,
          },
        });
      }
    }

    // 2. Prevent Duplicate Applications
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

    // 3. Academic Eligibility Validation
    const studentCgpa = Number(studentData.btechCgpa || studentData.cgpa || 0);
    const studentBranch = (studentData.branch || req.user.branch || '').toUpperCase();
    const studentActiveBacklogs = Number(studentData.activeBacklogs || 0);
    const studentBatch = Number(studentData.batchYear || req.user.batchYear || 2026);

    const ineligibilityReasons = [];

    if (eligibilityRules.minCgpa && studentCgpa < Number(eligibilityRules.minCgpa)) {
      ineligibilityReasons.push(
        `Your CGPA (${studentCgpa}) is below the required cutoff of ${eligibilityRules.minCgpa}.`
      );
    }

    if (
      Array.isArray(eligibilityRules.allowedBranches) &&
      eligibilityRules.allowedBranches.length > 0 &&
      !eligibilityRules.allowedBranches.includes(studentBranch)
    ) {
      ineligibilityReasons.push(
        `Branch '${studentBranch || 'Unspecified'}' is not eligible. Allowed: ${eligibilityRules.allowedBranches.join(', ')}.`
      );
    }

    if (
      eligibilityRules.maxActiveBacklogs !== undefined &&
      studentActiveBacklogs > Number(eligibilityRules.maxActiveBacklogs)
    ) {
      ineligibilityReasons.push(
        `Active backlogs (${studentActiveBacklogs}) exceed maximum allowed (${eligibilityRules.maxActiveBacklogs}).`
      );
    }

    if (ineligibilityReasons.length > 0) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INELIGIBLE_FOR_JOB',
          message: 'You do not satisfy the academic eligibility requirements for this job.',
          details: ineligibilityReasons,
        },
      });
    }

    // 4. Create Application Record
    const initialHistory = [
      {
        stage: 'Applied',
        changedBy: studentUserId,
        changedByRole: 'STUDENT',
        changedAt: new Date(),
        comments: 'Application submitted successfully by candidate.',
      },
    ];

    const application = new Application({
      jobId,
      jobTitle: jobTitle.trim(),
      companyId,
      companyName: companyName.trim(),
      studentUserId,
      studentId: studentData.studentId || req.user.studentId || 'O180123',
      studentName: studentData.studentName || req.user.fullName || 'Candidate',
      studentEmail: req.user.email,
      branch: studentBranch,
      btechCgpa: studentCgpa,
      activeBacklogs: studentActiveBacklogs,
      batchYear: studentBatch,
      resumeUrl: studentData.resumeUrl || '',
      skills: Array.isArray(studentData.skills) ? studentData.skills : [],
      coverLetter: coverLetter || '',
      stage: 'Applied',
      finalPlacementStatus: 'PENDING',
      history: initialHistory,
    });

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
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
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
    return res.status(500).json({
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
      if (req.user.companyId) {
        query.companyId = req.user.companyId;
      }
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
    return res.status(500).json({
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

    const userId = getUserId(req.user);

    // Authorization check
    if (req.user?.role === 'STUDENT' && application.studentUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this application.' },
      });
    }

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
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
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

    return res.status(200).json({
      success: true,
      message: `Candidate stage successfully updated to '${stage}'.`,
      data: { application },
    });
  } catch (err) {
    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      message: `Interview Round ${roundNumber} scheduled successfully.`,
      data: { application },
    });
  } catch (err) {
    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      message: 'Interview round evaluation submitted.',
      data: { application },
    });
  } catch (err) {
    return res.status(500).json({
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

    return res.status(200).json({
      success: true,
      message: 'Placement offer updated successfully.',
      data: { application },
    });
  } catch (err) {
    return res.status(500).json({
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

