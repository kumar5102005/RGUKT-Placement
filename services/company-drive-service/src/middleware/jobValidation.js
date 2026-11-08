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

    if (eligibility.maxActiveBacklogs !== undefined) {
      const backlogs = Number(eligibility.maxActiveBacklogs);
      if (isNaN(backlogs) || backlogs < 0) {
        errors.push({ field: 'eligibility.maxActiveBacklogs', message: 'Maximum backlogs must be non-negative.' });
      }
    }
  }

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
  const { title, description, applicationDeadline, roleCategory, workplaceType, salary, eligibility, status } = req.body;

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
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

