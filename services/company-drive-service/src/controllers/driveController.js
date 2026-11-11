import mongoose from 'mongoose';
import { Readable } from 'node:stream';
import PlacementDrive from '../models/PlacementDrive.js';
import DriveRegistration from '../models/DriveRegistration.js';
import Company from '../models/Company.js';
import Job from '../models/Job.js';
import { evaluateJobEligibility } from '../utils/eligibilityEvaluator.js';

const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || 'http://student-service:4002';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005';
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

export function shouldArchivePlacementDrive(registrationCount, linkedJob) {
  return registrationCount > 0 || Boolean(linkedJob);
}

async function getDriveRecruiterAccess(drive, userId) {
  const company = await Company.findOne({
    _id: drive.companyId,
    $or: [
      { registeredBy: String(userId) },
      { recruiters: { $elemMatch: { userId: String(userId), status: 'ACTIVE' } } },
    ],
  }).select('_id registeredBy recruiters').lean();
  if (!company) return { canView: false, canManage: false };
  const recruiter = (company.recruiters || []).find(
    (entry) => entry.userId === String(userId) && entry.status === 'ACTIVE'
  );
  const isOwner = company.registeredBy === String(userId);
  return {
    canView: true,
    canManage: Boolean(isOwner || recruiter?.role === 'PRIMARY' || recruiter?.canManageRecruitment),
  };
}

function getUserId(user) {
  return user?.userId || user?.id || user?._id;
}

async function getStudentData(studentUserId) {
  if (!SERVICE_API_KEY) {
    const error = new Error('SERVICE_API_KEY is not configured for student profile lookup.');
    error.statusCode = 503;
    error.code = 'SERVICE_CONFIGURATION_ERROR';
    throw error;
  }
  const response = await fetch(
    `${STUDENT_SERVICE_URL}/api/v1/students/internal/${encodeURIComponent(studentUserId)}`,
    { headers: { 'x-service-key': SERVICE_API_KEY } }
  );
  const result = await response.json();
  if (!response.ok || !result.success || !result.data) {
    const error = new Error(result.error?.message || 'Unable to retrieve the student profile.');
    error.statusCode = response.status || 502;
    error.code = result.error?.code || 'STUDENT_SERVICE_ERROR';
    throw error;
  }
  return result.data;
}

// ─── Placement Drive Management (Admin & Recruiter) ─────────────────────────

/**
 * POST /api/v1/drives/placement-drives
 * Create a new placement drive.
 * Access: ADMIN
 */
export async function createPlacementDrive(req, res) {
  try {
    const userId = getUserId(req.user);
    const {
      title,
      companyId,
      academicYear,
      batchYear,
      jobRoles,
      eligibilityCriteria,
      registrationWindow,
      recruitmentRounds,
      venue,
      coordinator,
      driveStatus,
    } = req.body;

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: { code: 'COMPANY_NOT_FOUND', message: 'Associated company not found.' },
      });
    }

    const drive = new PlacementDrive({
      title: title.trim(),
      companyId: company._id,
      companyName: company.name,
      companyLogo: company.logoUrl || '',
      academicYear: academicYear || '2025-2026',
      batchYear: batchYear || 2026,
      jobRoles: Array.isArray(jobRoles) ? jobRoles : [],
      eligibilityCriteria: eligibilityCriteria || {},
      registrationWindow: {
        openDate: registrationWindow?.openDate ? new Date(registrationWindow.openDate) : new Date(),
        closeDate: new Date(registrationWindow.closeDate),
      },
      recruitmentRounds: Array.isArray(recruitmentRounds) ? recruitmentRounds : [],
      venue: venue || 'RGUKT Ongole Campus / Online',
      coordinator: coordinator || {},
      driveStatus: driveStatus || 'REGISTRATION_OPEN',
      createdBy: userId,
    });

    await drive.save();

    // Increment company placement drive count
    await Company.findByIdAndUpdate(company._id, { $inc: { placementDriveCount: 1 } });

    return res.status(201).json({
      success: true,
      message: 'Placement drive created and scheduled successfully.',
      data: { drive },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/placement-drives
 * List placement drives with search, filter, and pagination.
 * Access: Authenticated.
 */
export async function getPlacementDrives(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      q,
      status,
      branch,
      batchYear,
      companyId,
      academicYear,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Students only see non-draft drives
    if (req.user?.role === 'STUDENT') {
      query.driveStatus = { $in: ['UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'] };
    } else if (status) {
      query.driveStatus = status;
    }

    if (companyId) query.companyId = companyId;
    if (batchYear) query.batchYear = Number(batchYear);
    if (academicYear) query.academicYear = academicYear;

    if (branch) {
      query['eligibilityCriteria.allowedBranches'] = branch.toUpperCase();
    }

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } },
        { driveCode: { $regex: q, $options: 'i' } },
      ];
    }

    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [drives, total] = await Promise.all([
      PlacementDrive.find(query)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      PlacementDrive.countDocuments(query),
    ]);
    let recruiterCompany = null;
    if (req.user?.role === 'RECRUITER') {
      recruiterCompany = await Company.findOne({
        $or: [
          { registeredBy: String(getUserId(req.user)) },
          { recruiters: { $elemMatch: { userId: String(getUserId(req.user)), status: 'ACTIVE' } } },
        ],
      }).select('_id registeredBy recruiters').lean();
    }
    const recruiterEntry = recruiterCompany?.recruiters?.find(
      (entry) => entry.userId === String(getUserId(req.user)) && entry.status === 'ACTIVE'
    );
    const recruiterCanManage = Boolean(
      recruiterCompany &&
      (recruiterCompany.registeredBy === String(getUserId(req.user)) ||
        recruiterEntry?.role === 'PRIMARY' ||
        recruiterEntry?.canManageRecruitment)
    );
    const visibleDrives = drives.map((drive) => ({
      ...drive,
      canViewCandidates: req.user?.role === 'ADMIN' ||
        (req.user?.role === 'RECRUITER' && String(recruiterCompany?._id) === String(drive.companyId)),
      canManageRecruitment: req.user?.role === 'RECRUITER' &&
        recruiterCanManage &&
        String(recruiterCompany?._id) === String(drive.companyId),
    }));

    return res.status(200).json({
      success: true,
      data: {
        drives: visibleDrives,
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
 * GET /api/v1/drives/placement-drives/:id
 * Retrieve single placement drive details.
 */
export async function getPlacementDriveById(req, res) {
  try {
    const drive = await PlacementDrive.findById(req.params.id).lean();

    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }

    if (req.user?.role === 'STUDENT' &&
        !['UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED'].includes(drive.driveStatus)) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive is in draft mode.' },
      });
    }

    // Check if the current student is registered
    let userRegistration = null;
    if (req.user?.role === 'STUDENT') {
      const studentUserId = getUserId(req.user);
      userRegistration = await DriveRegistration.findOne({
        driveId: drive._id,
        studentUserId,
      }).lean();
    }

    return res.status(200).json({
      success: true,
      data: { drive, userRegistration },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid drive ID format.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PUT /api/v1/drives/placement-drives/:id
 * Update placement drive parameters.
 * Access: ADMIN
 */
export async function updatePlacementDrive(req, res) {
  try {
    const drive = await PlacementDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }

    const updatable = [
      'title',
      'academicYear',
      'batchYear',
      'jobRoles',
      'eligibilityCriteria',
      'registrationWindow',
      'recruitmentRounds',
      'venue',
      'coordinator',
      'driveStatus',
    ];

    for (const key of updatable) {
      if (req.body[key] !== undefined) {
        drive[key] = req.body[key];
      }
    }

    await drive.save();

    return res.status(200).json({
      success: true,
      message: 'Placement drive updated successfully.',
      data: { drive },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * DELETE /api/v1/drives/placement-drives/:id
 * Delete an unreferenced drive or cancel it while preserving related history.
 * Access: ADMIN
 */
export async function deletePlacementDrive(req, res) {
  try {
    const drive = await PlacementDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }

    const [registrationCount, linkedJob] = await Promise.all([
      DriveRegistration.countDocuments({ driveId: drive._id }),
      Job.findOne({
        _id: { $in: (drive.jobRoles || []).map((role) => role.jobId).filter(Boolean) },
      }).select('_id').lean(),
    ]);

    if (shouldArchivePlacementDrive(registrationCount, linkedJob)) {
      drive.driveStatus = 'CANCELLED';
      await drive.save();
      return res.status(200).json({
        success: true,
        message: 'Drive cancelled because it has registration or job history. Existing records were retained.',
        data: { drive, archived: true },
      });
    }

    await drive.deleteOne();
    await Company.findByIdAndUpdate(drive.companyId, { $inc: { placementDriveCount: -1 } });

    return res.status(200).json({
      success: true,
      message: 'Unreferenced placement drive deleted.',
      data: { archived: false },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/drives/placement-drives/:id/status
 * Transition drive status.
 * Access: ADMIN
 */
export async function updateDriveStatus(req, res) {
  try {
    const { driveStatus } = req.body;
    if (!['DRAFT', 'UPCOMING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(driveStatus)) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid placement drive status.' },
      });
    }
    const drive = await PlacementDrive.findById(req.params.id);

    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }

    drive.driveStatus = driveStatus;
    await drive.save();

    return res.status(200).json({
      success: true,
      message: `Drive status changed to ${driveStatus}.`,
      data: { drive },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/v1/drives/placement-drives/:id/rounds
 * Schedule or add a round (Aptitude, Technical, HR).
 * Access: ADMIN
 */
export async function scheduleRound(req, res) {
  try {
    const {
      roundNumber,
      roundType,
      name,
      description,
      mode,
      scheduledDate,
      durationMinutes,
      venueOrLink,
      instructions,
      qualificationCriteria,
      status,
    } = req.body;

    const drive = await PlacementDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }

    const existingRoundIndex = drive.recruitmentRounds.findIndex((r) => r.roundNumber === Number(roundNumber));

    const roundData = {
      roundNumber: Number(roundNumber),
      roundType: roundType || 'APTITUDE',
      name: name.trim(),
      description: description || '',
      mode: mode || 'ONLINE',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      venueOrLink: venueOrLink || '',
      instructions: instructions || '',
      qualificationCriteria: qualificationCriteria || '',
      status: status || 'PLANNED',
      isCompleted: false,
    };

    if (existingRoundIndex >= 0) {
      drive.recruitmentRounds[existingRoundIndex] = roundData;
    } else {
      drive.recruitmentRounds.push(roundData);
      drive.recruitmentRounds.sort((a, b) => a.roundNumber - b.roundNumber);
    }

    await drive.save();

    return res.status(200).json({
      success: true,
      message: `Round ${roundNumber} (${name}) scheduled successfully.`,
      data: { recruitmentRounds: drive.recruitmentRounds },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

// ─── Student Drive Registration & Eligibility Enforcement ───────────────────

/**
 * POST /api/v1/drives/placement-drives/:id/register
 * Student registers for a placement drive.
 * Strictly verifies academic requirements, branches, backlogs, deadlines, and duplicates.
 * Access: STUDENT
 */
export async function registerStudentForDrive(req, res) {
  try {
    const studentUserId = getUserId(req.user);
    const drive = await PlacementDrive.findById(req.params.id);

    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }

    // 1. Check drive status
    if (['DRAFT', 'COMPLETED', 'CANCELLED'].includes(drive.driveStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REGISTRATION_CLOSED',
          message: `Drive is currently '${drive.driveStatus}' and not accepting candidate registrations.`,
        },
      });
    }

    // 2. Check registration deadline
    const deadline = new Date(drive.registrationWindow.closeDate);
    if (Date.now() > deadline.getTime()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DEADLINE_PASSED',
          message: `The registration deadline of ${deadline.toLocaleString()} has passed.`,
        },
      });
    }

    // 3. Check for existing duplicate registration
    const existing = await DriveRegistration.findOne({
      driveId: drive._id,
      studentUserId,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'ALREADY_REGISTERED',
          message: 'You have already registered for this placement drive.',
          data: { registration: existing },
        },
      });
    }

    // 4. Academic Eligibility Validation
    const studentData = await getStudentData(studentUserId);
    const criteria = drive.eligibilityCriteria.toObject
      ? drive.eligibilityCriteria.toObject()
      : drive.eligibilityCriteria;
    const evaluation = evaluateJobEligibility(
      {
        ...criteria,
        minTwelfthPucCgpa: criteria.minPucCgpa,
        genderPreference: criteria.eligibleGenders === 'FEMALE'
          ? 'Female Only'
          : criteria.eligibleGenders === 'MALE'
            ? 'Male Only'
            : 'All',
        eligibleBatchYears: [drive.batchYear],
      },
      studentData
    );
    if (evaluation.status !== 'ELIGIBLE') {
      return res.status(422).json({
        success: false,
        error: {
          code: evaluation.status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_ELIGIBILITY_DATA' : 'INELIGIBLE_FOR_DRIVE',
          message: evaluation.status === 'INSUFFICIENT_DATA'
            ? 'Complete the required academic information before registering for this placement drive.'
            : 'You do not meet the academic eligibility criteria for this placement drive.',
          details: evaluation.reasons,
          data: { evaluation },
        },
      });
    }

    // Initialize round progress from scheduled rounds
    const roundProgress = (drive.recruitmentRounds || []).map((r) => ({
      roundNumber: r.roundNumber,
      roundName: r.name,
      status: 'PENDING',
      remarks: '',
      score: null,
    }));

    const registration = new DriveRegistration({
      driveId: drive._id,
      driveTitle: drive.title,
      companyName: drive.companyName,
      studentUserId,
      studentId: studentData.studentId,
      studentName: studentData.fullName,
      studentEmail: studentData.email,
      branch: studentData.branch,
      btechCgpa: Number(studentData.btechCgpa),
      activeBacklogs: Number(studentData.activeBacklogs),
      batchYear: Number(studentData.batchYear),
      resumeUrl: studentData.resumeUrl || '',
      resumeFileName: studentData.resumeFileName || '',
      resumeOriginalName: studentData.resumeOriginalName || '',
      resumeMimeType: studentData.resumeMimeType || '',
      resumeSnapshotAt: studentData.resumeFileName ? new Date() : null,
      status: 'REGISTERED',
      roundProgress,
    });

    if (registration.resumeFileName) {
      registration.resumeUrl = `/api/v1/drives/placement-drives/${drive._id}/registrations/${registration._id}/resume`;
    }
    await registration.save();

    // Increment registered count on placement drive
    await PlacementDrive.findByIdAndUpdate(drive._id, { $inc: { registeredStudentsCount: 1 } });

    return res.status(201).json({
      success: true,
      message: 'Successfully registered for the placement drive! Good luck with your preparation.',
      data: { registration },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_REGISTERED', message: 'You have already registered for this drive.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/placement-drives/registrations/my
 * Retrieve all drives the current authenticated student has registered for.
 * Access: STUDENT
 */
export async function getMyDriveRegistrations(req, res) {
  try {
    const studentUserId = getUserId(req.user);

    const registrations = await DriveRegistration.find({ studentUserId })
      .populate('driveId', 'title companyName companyLogo driveCode venue recruitmentRounds registrationWindow driveStatus')
      .sort({ registeredAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { registrations },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/drives/placement-drives/:id/registrations
 * Admin list all registered candidates for a specific drive.
 * Access: ADMIN
 */
export async function getDriveRegistrations(req, res) {
  try {
    const drive = await PlacementDrive.findById(req.params.id).select('companyId').lean();
    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }
    if (req.user.role === 'RECRUITER') {
      const access = await getDriveRecruiterAccess(drive, getUserId(req.user));
      if (!access.canView) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You cannot view candidates for this company drive.' },
        });
      }
    }

    const { status, branch } = req.query;
    const query = { driveId: req.params.id };

    if (status) query.status = status;
    if (branch) query.branch = branch.toUpperCase();

    const registrations = await DriveRegistration.find(query)
      .sort({ btechCgpa: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { registrations, count: registrations.length },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/drives/placement-drives/:id/registrations/:registrationId/status
 * Update student status or advance round progress.
 * Access: ADMIN
 */
export async function updateRegistrationStatus(req, res) {
  try {
    const { status, roundNumber, roundStatus, remarks, score } = req.body;

    const drive = await PlacementDrive.findById(req.params.id).select('companyId').lean();
    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }
    const access = await getDriveRecruiterAccess(drive, getUserId(req.user));
    if (req.user.role !== 'RECRUITER' || !access.canManage) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized company recruiters can update drive decisions.' },
      });
    }

    const registration = await DriveRegistration.findOne({
      _id: req.params.registrationId,
      driveId: drive._id,
    });
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: { code: 'REGISTRATION_NOT_FOUND', message: 'Registration not found.' },
      });
    }

    if (status) {
      registration.status = status;
    }

    if (roundNumber !== undefined) {
      const round = registration.roundProgress.find((r) => r.roundNumber === Number(roundNumber));
      if (round) {
        if (roundStatus) round.status = roundStatus;
        if (remarks !== undefined) round.remarks = remarks;
        if (score !== undefined) round.score = score;
        round.updatedAt = new Date();
        round.updatedBy = String(getUserId(req.user));
      } else {
        return res.status(404).json({
          success: false,
          error: { code: 'ROUND_NOT_FOUND', message: `Round ${roundNumber} is not configured for this registration.` },
        });
      }
    }

    registration.decisionHistory.push({
      status: registration.status,
      roundNumber: roundNumber === undefined ? null : Number(roundNumber),
      roundStatus: roundNumber === undefined
        ? ''
        : registration.roundProgress.find((round) => round.roundNumber === Number(roundNumber))?.status || '',
      changedBy: String(getUserId(req.user)),
      changedAt: new Date(),
      remarks: remarks || '',
    });
    await registration.save();

    let notification = { delivered: false, warning: 'Notification was not configured.' };
    try {
      if (!SERVICE_API_KEY) throw new Error('SERVICE_API_KEY is not configured for notification delivery.');
      const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notifications/internal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-service-key': SERVICE_API_KEY },
        body: JSON.stringify({
          eventId: `${registration._id}:${registration.updatedAt.getTime()}`,
          userId: registration.studentUserId,
          type: 'APPLICATION_STATUS_CHANGED',
          title: 'Placement drive progress updated',
          message: `Your selection progress for ${registration.driveTitle} was updated.`,
          payload: { registrationId: registration._id, status: registration.status },
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || `Notification service returned ${response.status}.`);
      }
      notification = { delivered: true };
    } catch (error) {
      notification = { delivered: false, warning: error.message };
      console.error('Drive registration notification failed', {
        registrationId: String(registration._id),
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Student drive status updated.',
      data: { registration, notification },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

export async function getDriveRegistrationResume(req, res) {
  try {
    const registration = await DriveRegistration.findOne({
      _id: req.params.registrationId,
      driveId: req.params.id,
    }).lean();
    if (!registration) {
      return res.status(404).json({
        success: false,
        error: { code: 'REGISTRATION_NOT_FOUND', message: 'Registration not found.' },
      });
    }

    const userId = String(getUserId(req.user) || '');
    if (req.user.role === 'STUDENT' && registration.studentUserId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this resume.' },
      });
    }
    if (req.user.role === 'RECRUITER') {
      const drive = await PlacementDrive.findById(req.params.id).select('companyId').lean();
      const access = drive ? await getDriveRecruiterAccess(drive, userId) : { canView: false };
      if (!access.canView) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied to this resume.' },
        });
      }
    } else if (req.user.role !== 'STUDENT' && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this resume.' },
      });
    }
    if (!registration.resumeFileName) {
      return res.status(404).json({
        success: false,
        error: { code: 'RESUME_NOT_FOUND', message: 'No resume was attached to this registration.' },
      });
    }
    if (!SERVICE_API_KEY) {
      return res.status(503).json({
        success: false,
        error: { code: 'SERVICE_CONFIGURATION_ERROR', message: 'Resume service authorization is not configured.' },
      });
    }

    const response = await fetch(
      `${STUDENT_SERVICE_URL}/api/v1/students/internal/${encodeURIComponent(registration.studentUserId)}/resume?fileName=${encodeURIComponent(registration.resumeFileName)}`,
      { headers: { 'x-service-key': SERVICE_API_KEY } }
    );
    if (!response.ok) {
      const body = await response.text();
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        payload = null;
      }
      return res.status(response.status).json(payload || {
        success: false,
        error: { code: 'RESUME_SERVICE_ERROR', message: 'Unable to retrieve the registration resume.' },
      });
    }
    res.set({
      'Content-Type': response.headers.get('content-type') || registration.resumeMimeType || 'application/octet-stream',
      'Content-Disposition': response.headers.get('content-disposition') || 'attachment',
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
