import { BRANCHES, ROLE_CATEGORIES, WORKPLACE_TYPES, JOB_STATUSES } from '../models/Job.js';

function sendValidationError(res, details) {
  return res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Job validation failed',
      details,
    },
  });
}

function validateSelectionRounds(selectionRounds, errors) {
  if (!Array.isArray(selectionRounds)) {
    errors.push({ field: 'selectionRounds', message: 'Recruitment rounds must be an array.' });
    return;
  }

  const roundNumbers = new Set();
  let previousScheduledDate = null;
  selectionRounds.forEach((round, index) => {
    const field = `selectionRounds[${index}]`;
    const roundNumber = Number(round?.roundNumber);
    if (!Number.isInteger(roundNumber) || roundNumber !== index + 1 || roundNumbers.has(roundNumber)) {
      errors.push({ field: `${field}.roundNumber`, message: 'Round numbers must be unique and sequential, starting at 1.' });
    } else {
      roundNumbers.add(roundNumber);
    }

    if (typeof round?.name !== 'string' || round.name.trim().length < 2) {
      errors.push({ field: `${field}.name`, message: 'Round name must be at least 2 characters.' });
    }

    if (round?.mode !== undefined && !['Online', 'In-Person', 'Hybrid'].includes(round.mode)) {
      errors.push({ field: `${field}.mode`, message: 'Mode must be Online, In-Person, or Hybrid.' });
    }

    if (round?.scheduledDate) {
      const scheduledDate = new Date(round.scheduledDate);
      if (Number.isNaN(scheduledDate.getTime())) {
        errors.push({ field: `${field}.scheduledDate`, message: 'Round schedule must be a valid date and time.' });
      } else {
        if (previousScheduledDate && scheduledDate < previousScheduledDate) {
          errors.push({ field: `${field}.scheduledDate`, message: 'Scheduled rounds must be in chronological order.' });
        }
        previousScheduledDate = scheduledDate;
      }
    }

    if (round?.durationMinutes !== undefined && round.durationMinutes !== null &&
        (!Number.isInteger(Number(round.durationMinutes)) || Number(round.durationMinutes) < 1)) {
      errors.push({ field: `${field}.durationMinutes`, message: 'Duration must be a positive number of minutes.' });
    }

    if (round?.status !== undefined &&
        !['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(round.status)) {
      errors.push({ field: `${field}.status`, message: 'Invalid recruitment round status.' });
    }
  });
}

/**
 * Validates job creation payload.
 */
export function validateJobCreation(req, res, next) {
  const errors = [];
  const {
    title,
    description,
    applicationDeadline,
    roleCategory,
    workplaceType,
    salary,
    eligibility,
    companyId,
    selectionRounds,
  } = req.body;

  // Title
  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    errors.push({ field: 'title', message: 'Job title must be at least 3 characters long.' });
  }

  // Description
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    errors.push({ field: 'description', message: 'Job description must be at least 10 characters long.' });
  }

  // Application Deadline
  if (!applicationDeadline) {
    errors.push({ field: 'applicationDeadline', message: 'Application deadline is required.' });
  } else {
    const deadlineDate = new Date(applicationDeadline);
    if (isNaN(deadlineDate.getTime())) {
      errors.push({ field: 'applicationDeadline', message: 'Invalid deadline date format.' });
    }
  }

  // Role Category
  if (roleCategory && !ROLE_CATEGORIES.includes(roleCategory)) {
    errors.push({
      field: 'roleCategory',
      message: `Role category must be one of: ${ROLE_CATEGORIES.join(', ')}`,
    });
  }

  // Workplace Type
  if (workplaceType && !WORKPLACE_TYPES.includes(workplaceType)) {
    errors.push({
      field: 'workplaceType',
      message: `Workplace type must be one of: ${WORKPLACE_TYPES.join(', ')}`,
    });
  }

  // Salary Validation
  if (salary) {
    if (salary.minLpa !== undefined && (isNaN(salary.minLpa) || salary.minLpa < 0)) {
      errors.push({ field: 'salary.minLpa', message: 'Minimum LPA must be a non-negative number.' });
    }
    if (salary.maxLpa !== undefined && (isNaN(salary.maxLpa) || salary.maxLpa < 0)) {
      errors.push({ field: 'salary.maxLpa', message: 'Maximum LPA must be a non-negative number.' });
    }
    if (
      salary.minLpa !== undefined &&
      salary.maxLpa !== undefined &&
      Number(salary.minLpa) > Number(salary.maxLpa)
    ) {
      errors.push({
        field: 'salary.maxLpa',
        message: 'Maximum LPA cannot be less than Minimum LPA.',
      });
    }
  }

  // Eligibility Rules Validation
  if (eligibility) {
    if (eligibility.minCgpa !== undefined) {
      const cgpa = Number(eligibility.minCgpa);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        errors.push({ field: 'eligibility.minCgpa', message: 'Minimum CGPA must be between 0.0 and 10.0.' });
      }
    }

    if (eligibility.allowedBranches !== undefined) {
      if (!Array.isArray(eligibility.allowedBranches)) {
        errors.push({ field: 'eligibility.allowedBranches', message: 'Allowed branches must be an array.' });
      } else {
        const invalidBranches = eligibility.allowedBranches.filter((b) => !BRANCHES.includes(b));
        if (invalidBranches.length > 0) {
          errors.push({
            field: 'eligibility.allowedBranches',
            message: `Invalid branches specified: ${invalidBranches.join(', ')}. Valid options: ${BRANCHES.join(', ')}`,
          });
        }
      }
    }

    for (const field of ['maxActiveBacklogs', 'maxHistoryBacklogs']) {
      if (eligibility[field] !== undefined) {
        const backlogs = Number(eligibility[field]);
        if (!Number.isInteger(backlogs) || backlogs < 0) {
          errors.push({ field: `eligibility.${field}`, message: 'Backlog limits must be non-negative integers.' });
        }
      }
    }

    if (eligibility.minTenthPercentage !== undefined) {
      const percentage = Number(eligibility.minTenthPercentage);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        errors.push({ field: 'eligibility.minTenthPercentage', message: 'Minimum 10th percentage must be between 0 and 100.' });
      }
    }

    if (eligibility.minTwelfthPucCgpa !== undefined) {
      const cgpa = Number(eligibility.minTwelfthPucCgpa);
      if (!Number.isFinite(cgpa) || cgpa < 0 || cgpa > 10) {
        errors.push({ field: 'eligibility.minTwelfthPucCgpa', message: 'Minimum PUC CGPA must be between 0 and 10.' });
      }
    }

    if (eligibility.eligibleBatchYears !== undefined &&
        (!Array.isArray(eligibility.eligibleBatchYears) ||
          eligibility.eligibleBatchYears.some((year) => !Number.isInteger(Number(year))))) {
      errors.push({ field: 'eligibility.eligibleBatchYears', message: 'Eligible graduation years must be an array of whole years.' });
    }
    if (eligibility.eligibleBatchYears !== undefined && Array.isArray(eligibility.eligibleBatchYears) &&
        eligibility.eligibleBatchYears.some((year) => Number(year) < 2000 || Number(year) > 2200)) {
      errors.push({ field: 'eligibility.eligibleBatchYears', message: 'Eligible graduation years must be between 2000 and 2200.' });
    }
  }

  if (selectionRounds !== undefined) validateSelectionRounds(selectionRounds, errors);

  // Admin creating job must specify companyId
  if (req.user?.role === 'ADMIN' && !companyId) {
    errors.push({ field: 'companyId', message: 'Admin must provide companyId when creating a job posting.' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates job update payload (partial).
 */
export function validateJobUpdate(req, res, next) {
  const errors = [];
  const {
    title,
    description,
    applicationDeadline,
    roleCategory,
    workplaceType,
    salary,
    eligibility,
    status,
    selectionRounds,
  } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim().length < 3)) {
    errors.push({ field: 'title', message: 'Job title must be at least 3 characters long.' });
  }

  if (description !== undefined && (typeof description !== 'string' || description.trim().length < 10)) {
    errors.push({ field: 'description', message: 'Job description must be at least 10 characters long.' });
  }

  if (applicationDeadline !== undefined) {
    const d = new Date(applicationDeadline);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'applicationDeadline', message: 'Invalid deadline date format.' });
    }
  }

  if (roleCategory !== undefined && !ROLE_CATEGORIES.includes(roleCategory)) {
    errors.push({ field: 'roleCategory', message: `Role category must be one of: ${ROLE_CATEGORIES.join(', ')}` });
  }

  if (workplaceType !== undefined && !WORKPLACE_TYPES.includes(workplaceType)) {
    errors.push({ field: 'workplaceType', message: `Workplace type must be one of: ${WORKPLACE_TYPES.join(', ')}` });
  }

  if (status !== undefined && !JOB_STATUSES.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${JOB_STATUSES.join(', ')}` });
  }

  if (salary) {
    if (salary.minLpa !== undefined && (isNaN(salary.minLpa) || salary.minLpa < 0)) {
      errors.push({ field: 'salary.minLpa', message: 'Minimum LPA must be a non-negative number.' });
    }
    if (salary.maxLpa !== undefined && (isNaN(salary.maxLpa) || salary.maxLpa < 0)) {
      errors.push({ field: 'salary.maxLpa', message: 'Maximum LPA must be a non-negative number.' });
    }
  }

  if (eligibility) {
    if (eligibility.minCgpa !== undefined) {
      const cgpa = Number(eligibility.minCgpa);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        errors.push({ field: 'eligibility.minCgpa', message: 'Minimum CGPA must be between 0.0 and 10.0.' });
      }
    }
    if (eligibility.allowedBranches !== undefined && Array.isArray(eligibility.allowedBranches)) {
      const invalidBranches = eligibility.allowedBranches.filter((b) => !BRANCHES.includes(b));
      if (invalidBranches.length > 0) {
        errors.push({ field: 'eligibility.allowedBranches', message: `Invalid branches: ${invalidBranches.join(', ')}` });
      }
    }
    for (const field of ['maxActiveBacklogs', 'maxHistoryBacklogs']) {
      if (eligibility[field] !== undefined &&
          (!Number.isInteger(Number(eligibility[field])) || Number(eligibility[field]) < 0)) {
        errors.push({ field: `eligibility.${field}`, message: 'Backlog limits must be non-negative integers.' });
      }
    }
    if (eligibility.minTenthPercentage !== undefined &&
        (!Number.isFinite(Number(eligibility.minTenthPercentage)) ||
          Number(eligibility.minTenthPercentage) < 0 || Number(eligibility.minTenthPercentage) > 100)) {
      errors.push({ field: 'eligibility.minTenthPercentage', message: 'Minimum 10th percentage must be between 0 and 100.' });
    }
    if (eligibility.minTwelfthPucCgpa !== undefined &&
        (!Number.isFinite(Number(eligibility.minTwelfthPucCgpa)) ||
          Number(eligibility.minTwelfthPucCgpa) < 0 || Number(eligibility.minTwelfthPucCgpa) > 10)) {
      errors.push({ field: 'eligibility.minTwelfthPucCgpa', message: 'Minimum PUC CGPA must be between 0 and 10.' });
    }
    if (eligibility.eligibleBatchYears !== undefined &&
        (!Array.isArray(eligibility.eligibleBatchYears) ||
          eligibility.eligibleBatchYears.some((year) =>
            !Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2200
          ))) {
      errors.push({ field: 'eligibility.eligibleBatchYears', message: 'Eligible graduation years must be whole years between 2000 and 2200.' });
    }
  }

  if (selectionRounds !== undefined) validateSelectionRounds(selectionRounds, errors);

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}
