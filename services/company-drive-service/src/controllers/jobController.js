import mongoose from 'mongoose';
import Job from '../models/Job.js';
import Company from '../models/Company.js';
import { evaluateJobEligibility } from '../utils/eligibilityEvaluator.js';

const STUDENT_SERVICE_URL = process.env.STUDENT_SERVICE_URL || 'http://student-service:4002';
const APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://application-service:4004';
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(user) {
  return user?.userId || user?.id || user?._id;
}

function hideStudentRoundDetails(job) {
  return {
    ...job,
    selectionRounds: (job.selectionRounds || []).map((round) => ({
      roundNumber: round.roundNumber,
      name: round.name,
      description: round.description,
      mode: round.mode,
    })),
  };
}

async function findRecruiterCompany(userId) {
  return await Company.findOne({
    $or: [
      { registeredBy: userId },
      { recruiters: { $elemMatch: { userId, status: 'ACTIVE' } } },
    ],
  });
}

async function getStudentData(studentUserId) {
  if (!studentUserId) {
    const error = new Error('Student account ID is required for eligibility evaluation.');
    error.statusCode = 400;
    error.code = 'STUDENT_ACCOUNT_REQUIRED';
    throw error;
  }
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

async function getJobEligibility(jobId, studentUserId) {
  const job = await Job.findById(jobId).lean();
  if (!job) return { error: { status: 404, code: 'JOB_NOT_FOUND', message: 'Job posting not found.' } };

  const student = await getStudentData(studentUserId);
  const evaluation = evaluateJobEligibility(job.eligibility, student);
  return {
    job,
    student,
    evaluation,
  };
}

function jobRoundSnapshot(rounds) {
  return rounds.map((round) => ({
    roundNumber: round.roundNumber,
    name: round.name,
    description: round.description || '',
    mode: round.mode,
    scheduledDate: round.scheduledDate || null,
    durationMinutes: round.durationMinutes ?? null,
    venueOrLink: round.venueOrLink || '',
    status: round.status || 'PLANNED',
  }));
}

async function syncRecruitmentRounds(job) {
  if (!SERVICE_API_KEY) {
    const error = new Error('SERVICE_API_KEY is not configured for application synchronization.');
    error.statusCode = 503;
    error.code = 'SERVICE_CONFIGURATION_ERROR';
    throw error;
  }

  const response = await fetch(
    `${APPLICATION_SERVICE_URL}/api/v1/applications/internal/jobs/${job._id}/recruitment-rounds`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': SERVICE_API_KEY,
      },
      body: JSON.stringify({
        jobId: job._id,
        jobTitle: job.title,
        companyName: job.companyName,
        rounds: jobRoundSnapshot(job.selectionRounds || []),
      }),
    }
  );
  const result = await response.json();
  if (!response.ok || !result.success) {
    const error = new Error(result.error?.message || 'Unable to synchronize recruitment rounds with applications.');
    error.statusCode = response.status || 502;
    error.code = result.error?.code || 'APPLICATION_SYNC_FAILED';
    throw error;
  }
}

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/jobs
 * Create a new job posting.
 * Access: RECRUITER (for own verified company) or ADMIN (for any company).
 */
export async function createJob(req, res) {
  try {
    const userId = getUserId(req.user);
    const userRole = req.user.role;

    let targetCompany = null;

    if (userRole === 'RECRUITER') {
      targetCompany = await findRecruiterCompany(userId);
      if (!targetCompany) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COMPANY_NOT_FOUND',
            message: 'You must register a company profile before posting jobs.',
          },
        });
      }

      if (targetCompany.verificationStatus !== 'VERIFIED') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'COMPANY_NOT_VERIFIED',
            message: `Your company verification status is currently '${targetCompany.verificationStatus}'. Only verified companies can publish job postings.`,
          },
        });
      }
    } else if (userRole === 'ADMIN') {
      const { companyId } = req.body;
      targetCompany = await Company.findById(companyId);
      if (!targetCompany) {
        return res.status(404).json({
          success: false,
          error: { code: 'COMPANY_NOT_FOUND', message: 'Target company not found.' },
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only Recruiters and Admins can create job postings.' },
      });
    }

    const {
      title,
      roleCategory,
      workplaceType,
      locations,
      description,
      responsibilities,
      requirements,
      requiredSkills,
      preferredSkills,
      salary,
      eligibility,
      selectionRounds,
      applicationDeadline,
      driveDate,
      status,
    } = req.body;

    const job = new Job({
      companyId: targetCompany._id,
      companyName: targetCompany.name,
      companyLogo: targetCompany.logoUrl || '',
      title: title.trim(),
      roleCategory: roleCategory || 'Full-Time',
      workplaceType: workplaceType || 'On-site',
      locations: Array.isArray(locations) && locations.length > 0 ? locations : [targetCompany.location?.city || 'Ongole'],
      description: description.trim(),
      responsibilities: Array.isArray(responsibilities) ? responsibilities : [],
      requirements: Array.isArray(requirements) ? requirements : [],
      requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
      preferredSkills: Array.isArray(preferredSkills) ? preferredSkills : [],
      salary: salary || {},
      eligibility: eligibility || {},
      selectionRounds: Array.isArray(selectionRounds) ? selectionRounds : undefined,
      applicationDeadline: new Date(applicationDeadline),
      driveDate: driveDate ? new Date(driveDate) : null,
      status: status || 'ACTIVE',
      createdBy: userId,
      createdByRole: userRole,
    });

    await job.save();

    // Increment company placement drive count
    await Company.findByIdAndUpdate(targetCompany._id, {
      $inc: { placementDriveCount: 1 },
    });

    return res.status(201).json({
      success: true,
      message: 'Job posting created successfully.',
      data: { job },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/jobs
 * List jobs with comprehensive filtering, search, and pagination.
 * Access: Authenticated (STUDENT, RECRUITER, ADMIN).
 * Note: Students only see ACTIVE jobs with deadlines in the future (or open).
 */
export async function getJobs(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      q,
      branch,
      minCgpa,
      maxBacklogs,
      batchYear,
      roleCategory,
      workplaceType,
      city,
      minSalary,
      status,
      companyId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const query = {};

    // Role-based visibility
    if (req.user?.role === 'STUDENT') {
      query.status = 'ACTIVE';
      // Only jobs with upcoming deadline or today
      query.applicationDeadline = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    } else if (status) {
      query.status = status;
    }

    if (companyId) {
      query.companyId = companyId;
    }

    // Text Search
    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { companyName: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { requiredSkills: { $in: [new RegExp(q, 'i')] } },
      ];
    }

    // Branch filter
    if (branch) {
      query['eligibility.allowedBranches'] = branch.toUpperCase();
    }

    // CGPA filter
    if (minCgpa) {
      query['eligibility.minCgpa'] = { $lte: Number(minCgpa) };
    }

    // Backlog filter
    if (maxBacklogs !== undefined && maxBacklogs !== '') {
      query['eligibility.maxActiveBacklogs'] = { $gte: Number(maxBacklogs) };
    }

    // Batch year filter
    if (batchYear) {
      query['eligibility.eligibleBatchYears'] = Number(batchYear);
    }

    // Role Category & Workplace Type
    if (roleCategory) query.roleCategory = roleCategory;
    if (workplaceType) query.workplaceType = workplaceType;

    // Location / City
    if (city) {
      query.locations = { $regex: city, $options: 'i' };
    }

    // Salary filter
    if (minSalary) {
      query['salary.maxLpa'] = { $gte: Number(minSalary) };
    }

    const allowedSortFields = ['createdAt', 'applicationDeadline', 'salary.maxLpa', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Job.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        jobs: req.user?.role === 'STUDENT' ? jobs.map(hideStudentRoundDetails) : jobs,
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
 * GET /api/v1/jobs/my
 * Get jobs created by the authenticated recruiter's company.
 * Access: RECRUITER only.
 */
export async function getRecruiterJobs(req, res) {
  try {
    const userId = getUserId(req.user);
    const company = await findRecruiterCompany(userId);

    if (!company) {
      return res.status(200).json({
        success: true,
        data: { jobs: [], company: null },
      });
    }

    const jobs = await Job.find({ companyId: company._id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        jobs: req.user?.role === 'STUDENT' ? jobs.map(hideStudentRoundDetails) : jobs,
        company,
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
 * GET /api/v1/jobs/:id
 * Retrieve full details of a specific job posting.
 * Access: Authenticated.
 */
export async function getJobById(req, res) {
  try {
    const job = await Job.findById(req.params.id).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found.' },
      });
    }

    // Students cannot view DRAFT jobs
    if (req.user?.role === 'STUDENT' && job.status === 'DRAFT') {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting is not active.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        job: req.user?.role === 'STUDENT' ? hideStudentRoundDetails(job) : job,
      },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid job ID format.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PUT /api/v1/jobs/:id
 * Edit an existing job posting.
 * Access: ADMIN or the RECRUITER who owns the job's company.
 */
export async function updateJob(req, res) {
  try {
    const userId = getUserId(req.user);
    const userRole = req.user.role;

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found.' },
      });
    }

    // Authorization check
    if (userRole === 'RECRUITER') {
      const company = await findRecruiterCompany(userId);
      if (!company || company._id.toString() !== job.companyId.toString()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only update jobs for your own company.' },
        });
      }
    }

    const previousRounds = JSON.stringify(jobRoundSnapshot(job.selectionRounds || []));
    const updatableFields = [
      'title',
      'roleCategory',
      'workplaceType',
      'locations',
      'description',
      'responsibilities',
      'requirements',
      'requiredSkills',
      'preferredSkills',
      'salary',
      'eligibility',
      'selectionRounds',
      'applicationDeadline',
      'driveDate',
      'status',
    ];

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        if (field === 'applicationDeadline' || field === 'driveDate') {
          job[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          job[field] = req.body[field];
        }
      }
    }

    const roundsChanged = req.body.selectionRounds !== undefined &&
      JSON.stringify(jobRoundSnapshot(job.selectionRounds || [])) !== previousRounds;
    const shouldSyncRounds = roundsChanged || job.roundsSyncPending;
    if (shouldSyncRounds) {
      job.roundsSyncPending = true;
    }

    await job.save();

    if (shouldSyncRounds) {
      try {
        await syncRecruitmentRounds(job);
        job.roundsSyncPending = false;
        await job.save();
      } catch (syncError) {
        return res.status(syncError.statusCode || 502).json({
          success: false,
          error: {
            code: 'RECRUITMENT_ROUND_SYNC_FAILED',
            message: `The job posting was saved, but its recruitment rounds could not be synchronized: ${syncError.message}`,
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Job posting updated successfully.',
      data: { job },
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid job ID format.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * DELETE /api/v1/jobs/:id
 * Delete a job posting.
 * Access: ADMIN or the RECRUITER who owns the job's company.
 */
export async function deleteJob(req, res) {
  try {
    const userId = getUserId(req.user);
    const userRole = req.user.role;

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found.' },
      });
    }

    // Authorization check
    if (userRole === 'RECRUITER') {
      const company = await findRecruiterCompany(userId);
      if (!company || company._id.toString() !== job.companyId.toString()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only delete jobs for your own company.' },
        });
      }
    }

    await Job.findByIdAndDelete(req.params.id);

    // Decrement company placement drive count
    await Company.findByIdAndUpdate(job.companyId, {
      $inc: { placementDriveCount: -1 },
    });

    return res.status(200).json({
      success: true,
      message: 'Job posting deleted successfully.',
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID', message: 'Invalid job ID format.' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * PATCH /api/v1/jobs/:id/status
 * Quickly transition job status (DRAFT, ACTIVE, PAUSED, CLOSED).
 * Access: ADMIN or RECRUITER (for own company).
 */
export async function updateJobStatus(req, res) {
  try {
    const { status } = req.body;
    const userId = getUserId(req.user);
    const userRole = req.user.role;

    if (!['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED'].includes(status)) {
      return res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status value.' },
      });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found.' },
      });
    }

    if (userRole === 'RECRUITER') {
      const company = await findRecruiterCompany(userId);
      if (!company || company._id.toString() !== job.companyId.toString()) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You can only manage status for your own company jobs.' },
        });
      }
    }

    job.status = status;
    await job.save();

    return res.status(200).json({
      success: true,
      message: `Job status updated to ${status}.`,
      data: { job },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * POST /api/v1/jobs/:id/check-eligibility
 * Evaluates candidate data against the job's configurable eligibility rules.
 * Access: Authenticated.
 */
export async function checkEligibility(req, res) {
  try {
    const result = await getJobEligibility(req.params.id, getUserId(req.user));
    if (result.error) {
      return res.status(404).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        jobId: result.job._id,
        jobTitle: result.job.title,
        companyName: result.job.companyName,
        eligibilityRules: result.job.eligibility,
        evaluation: result.evaluation,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

export async function checkInternalJobEligibility(req, res) {
  try {
    const result = await getJobEligibility(req.params.id, req.body.studentUserId);
    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        error: { code: result.error.code, message: result.error.message },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        job: {
          jobId: result.job._id,
          companyId: result.job.companyId,
          companyName: result.job.companyName,
          title: result.job.title,
          status: result.job.status,
          applicationDeadline: result.job.applicationDeadline,
          selectionRounds: result.job.selectionRounds,
        },
        student: result.student,
        evaluation: result.evaluation,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

export async function checkInternalEligibility(req, res) {
  try {
    const { studentUserId, eligibilityCriteria = {}, eligibleBatchYear } = req.body;
    const student = await getStudentData(studentUserId);
    const eligibleBatchYears = eligibilityCriteria.eligibleBatchYears ||
      (eligibleBatchYear === undefined || eligibleBatchYear === null ? [] : [eligibleBatchYear]);
    const evaluation = evaluateJobEligibility(
      { ...eligibilityCriteria, eligibleBatchYears },
      student
    );

    return res.status(200).json({
      success: true,
      data: { student, evaluation },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message },
    });
  }
}

/**
 * GET /api/v1/jobs/internal/:id
 * Internal microservice query endpoint for downstream services (e.g. Application Service).
 * Auth: Requires x-service-key header.
 */
export async function getInternalJobData(req, res) {
  try {
    const job = await Job.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: 'Job posting not found.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        jobId: job._id,
        companyId: job.companyId,
        companyName: job.companyName,
        title: job.title,
        status: job.status,
        applicationDeadline: job.applicationDeadline,
        eligibility: job.eligibility,
        selectionRounds: job.selectionRounds,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message },
    });
  }
}
