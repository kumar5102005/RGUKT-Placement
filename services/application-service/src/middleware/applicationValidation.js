import { STANDARD_STAGES, PLACEMENT_STATUSES } from '../models/Application.js';

function sendValidationError(res, details) {
  return res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Application validation failed',
      details,
    },
  });
}

/**
 * Validates application submission by a student.
 */
export function validateApplicationSubmission(req, res, next) {
  const errors = [];
  const { jobId } = req.body;

  if (!jobId) {
    errors.push({ field: 'jobId', message: 'Job ID is required.' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates stage update.
 */
export function validateStageTransition(req, res, next) {
  const errors = [];
  const { stage } = req.body;

  if (!stage || typeof stage !== 'string') {
    errors.push({ field: 'stage', message: 'Target stage is required.' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}

/**
 * Validates interview schedule.
 */
export function validateInterviewSchedule(req, res, next) {
  const errors = [];
  const { roundNumber, roundName, scheduledAt, mode } = req.body;

  if (roundNumber === undefined || isNaN(Number(roundNumber)) || Number(roundNumber) < 1) {
    errors.push({ field: 'roundNumber', message: 'Valid round number >= 1 is required.' });
  }

  if (!roundName || typeof roundName !== 'string' || roundName.trim().length < 2) {
    errors.push({ field: 'roundName', message: 'Round name is required.' });
  }

  if (!scheduledAt) {
    errors.push({ field: 'scheduledAt', message: 'Scheduled date and time is required.' });
  } else {
    const d = new Date(scheduledAt);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'scheduledAt', message: 'Invalid scheduled date format.' });
    }
  }

  if (mode && !['ONLINE', 'IN_PERSON', 'HYBRID'].includes(mode)) {
    errors.push({ field: 'mode', message: 'Mode must be ONLINE, IN_PERSON, or HYBRID.' });
  }

  if (errors.length > 0) {
    return sendValidationError(res, errors);
  }

  next();
}
