import { BRANCHES, DRIVE_STATUSES, ROUND_TYPES } from '../models/PlacementDrive.js';

function sendValidationError(res, details) {
  return res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Drive validation failed',
      details,
    },
  });
}

/**
 * Validates placement drive creation payload.
 */
export function validateDriveCreation(req, res, next) {
  const errors = [];
  const { title, companyId, registrationWindow, eligibilityCriteria } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    errors.push({ field: 'title', message: 'Drive title must be at least 3 characters long.' });
  }

  if (!companyId) {
    errors.push({ field: 'companyId', message: 'Company association is required.' });
  }

  if (!registrationWindow?.closeDate) {
    errors.push({ field: 'registrationWindow.closeDate', message: 'Registration close deadline is required.' });
  } else {
    const d = new Date(registrationWindow.closeDate);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'registrationWindow.closeDate', message: 'Invalid registration close date format.' });
    }
  }

  if (eligibilityCriteria) {
    if (eligibilityCriteria.minCgpa !== undefined) {
      const cgpa = Number(eligibilityCriteria.minCgpa);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        errors.push({ field: 'eligibilityCriteria.minCgpa', message: 'Minimum CGPA must be between 0.0 and 10.0.' });
      }
    }

    if (eligibilityCriteria.allowedBranches !== undefined) {
      if (!Array.isArray(eligibilityCriteria.allowedBranches)) {
        errors.push({ field: 'eligibilityCriteria.allowedBranches', message: 'Allowed branches must be an array.' });
      } else {
        const invalid = eligibilityCriteria.allowedBranches.filter((b) => !BRANCHES.includes(b));
        if (invalid.length > 0) {
          errors.push({
            field: 'eligibilityCriteria.allowedBranches',
            message: `Invalid branches: ${invalid.join(', ')}. Valid options: ${BRANCHES.join(', ')}`,
          });
        }
      }
    }
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates round scheduling.
 */
export function validateRoundSchedule(req, res, next) {
  const errors = [];
  const { roundNumber, roundType, name, mode } = req.body;

  if (roundNumber === undefined || isNaN(Number(roundNumber)) || Number(roundNumber) < 1) {
    errors.push({ field: 'roundNumber', message: 'Valid round number >= 1 is required.' });
  }

  if (roundType && !ROUND_TYPES.includes(roundType)) {
    errors.push({
      field: 'roundType',
      message: `Round type must be one of: ${ROUND_TYPES.join(', ')}`,
    });
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Round name is required.' });
  }

  if (mode && !['ONLINE', 'IN_PERSON', 'HYBRID'].includes(mode)) {
    errors.push({ field: 'mode', message: 'Mode must be ONLINE, IN_PERSON, or HYBRID.' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

