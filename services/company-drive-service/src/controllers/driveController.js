import mongoose from 'mongoose';
import PlacementDrive from '../models/PlacementDrive.js';
import DriveRegistration from '../models/DriveRegistration.js';
import Company from '../models/Company.js';

function getUserId(user) {
  return user?.userId || user?.id || user?._id;
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
      recruitmentRounds: Array.isArray(recruitmentRounds) && recruitmentRounds.length > 0 ? recruitmentRounds : undefined,
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

    return res.status(200).json({
      success: true,
      data: {
        drives,
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

    if (req.user?.role === 'STUDENT' && drive.driveStatus === 'DRAFT') {
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
 * Delete a placement drive.
 * Access: ADMIN
 */
export async function deletePlacementDrive(req, res) {
  try {
    const drive = await PlacementDrive.findByIdAndDelete(req.params.id);
    if (!drive) {
      return res.status(404).json({
        success: false,
        error: { code: 'DRIVE_NOT_FOUND', message: 'Placement drive not found.' },
      });
    }

    // Decrement company placement drive count
    await Company.findByIdAndUpdate(drive.companyId, { $inc: { placementDriveCount: -1 } });

    // Clean up registrations
    await DriveRegistration.deleteMany({ driveId: drive._id });

    return res.status(200).json({
      success: true,
      message: 'Placement drive and associated registrations deleted.',
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
    const { roundNumber, roundType, name, description, mode, scheduledDate, venueOrLink, instructions } = req.body;

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
      venueOrLink: venueOrLink || '',
      instructions: instructions || '',
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
    const studentData = req.body.studentData || {};
    const studentBranch = (studentData.branch || req.user.branch || '').toUpperCase();
    const studentCgpa = Number(studentData.btechCgpa || studentData.cgpa || 0);
    const studentActiveBacklogs = Number(studentData.activeBacklogs || 0);
    const studentBatch = Number(studentData.batchYear || req.user.batchYear || 2026);

    const criteria = drive.eligibilityCriteria;
    const ineligibilityReasons = [];

    // CGPA check
    if (criteria.minCgpa && studentCgpa < criteria.minCgpa) {
      ineligibilityReasons.push(`Your B.Tech CGPA (${studentCgpa}) is below required minimum of ${criteria.minCgpa}.`);
    }

    // Branch check
    if (criteria.allowedBranches?.length > 0 && !criteria.allowedBranches.includes(studentBranch)) {
      ineligibilityReasons.push(
        `Branch '${studentBranch || 'Unspecified'}' is not eligible. Allowed branches: ${criteria.allowedBranches.join(', ')}.`
      );
    }

    // Active backlogs check
    if (criteria.maxActiveBacklogs !== undefined && studentActiveBacklogs > criteria.maxActiveBacklogs) {
      ineligibilityReasons.push(
        `Your active backlogs (${studentActiveBacklogs}) exceed maximum allowed threshold of ${criteria.maxActiveBacklogs}.`
      );
    }

    if (ineligibilityReasons.length > 0) {
      return res.status(422).json({
        success: false,
        error: {
          code: 'INELIGIBLE_FOR_DRIVE',
          message: 'You do not meet the academic eligibility criteria for this placement drive.',
          details: ineligibilityReasons,
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
      studentId: studentData.studentId || req.user.studentId || req.user.email?.split('@')[0] || 'O180123',
      studentName: studentData.studentName || req.user.fullName || 'Student',
      studentEmail: req.user.email,
      branch: studentBranch,
      btechCgpa: studentCgpa,
      activeBacklogs: studentActiveBacklogs,
      batchYear: studentBatch,
      resumeUrl: studentData.resumeUrl || '',
      status: 'REGISTERED',
      roundProgress,
    });

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
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
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

    const registration = await DriveRegistration.findById(req.params.registrationId);
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
      }
    }

    await registration.save();

    return res.status(200).json({
      success: true,
      message: 'Student drive status updated.',
      data: { registration },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

