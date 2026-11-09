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

function validateRecruitmentRounds(rounds) {
  if (rounds === undefined) return [];
  if (!Array.isArray(rounds)) {
    return [{ field: 'recruitmentRounds', message: 'Recruitment rounds must be an array.' }];
  }

  const errors = [];
  rounds.forEach((round, index) => {
    const prefix = `recruitmentRounds[${index}]`;
    if (Number(round.roundNumber) !== index + 1) {
      errors.push({ field: `${prefix}.roundNumber`, message: 'Round sequence must be consecutive, starting at 1.' });
    }
    if (typeof round.name !== 'string' || round.name.trim().length < 2) {
      errors.push({ field: `${prefix}.name`, message: 'Round name must contain at least 2 characters.' });
    }
    if (!ROUND_TYPES.includes(round.roundType)) {
      errors.push({ field: `${prefix}.roundType`, message: `Round type must be one of: ${ROUND_TYPES.join(', ')}.` });
    }
    if (round.mode !== undefined && !['ONLINE', 'IN_PERSON', 'HYBRID'].includes(round.mode)) {
      errors.push({ field: `${prefix}.mode`, message: 'Mode must be ONLINE, IN_PERSON, or HYBRID.' });
    }
    if (round.scheduledDate) {
      const scheduledDate = new Date(round.scheduledDate);
      if (Number.isNaN(scheduledDate.getTime())) {
        errors.push({ field: `${prefix}.scheduledDate`, message: 'Scheduled date must be valid.' });
      }
    }
    if (round.durationMinutes !== undefined && round.durationMinutes !== null) {
      const duration = Number(round.durationMinutes);
      if (!Number.isInteger(duration) || duration < 1) {
        errors.push({ field: `${prefix}.durationMinutes`, message: 'Duration must be a positive whole number of minutes.' });
      }
    }
    if (round.status !== undefined && !['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(round.status)) {
      errors.push({ field: `${prefix}.status`, message: 'Invalid round status.' });
    }
    if (round.qualificationCriteria !== undefined && typeof round.qualificationCriteria !== 'string') {
      errors.push({ field: `${prefix}.qualificationCriteria`, message: 'Qualification criteria must be text.' });
    }
  });
  return errors;
}

/**
 * Validates placement drive creation payload.
 */
export function validateDriveCreation(req, res, next) {
  const errors = [];
  const { title, companyId, registrationWindow, eligibilityCriteria } = req.body;
  errors.push(...validateRecruitmentRounds(req.body.recruitmentRounds));

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

export function validateDriveUpdate(req, res, next) {
  const errors = req.body.recruitmentRounds === undefined
    ? []
    : validateRecruitmentRounds(req.body.recruitmentRounds);
  if (errors.length > 0) return sendValidationError(res, errors);
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
