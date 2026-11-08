import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateDriveCreation, validateRoundSchedule } from '../middleware/driveValidation.js';
import {
  createPlacementDrive,
  getPlacementDrives,
  getPlacementDriveById,
  updatePlacementDrive,
  deletePlacementDrive,
  updateDriveStatus,
  scheduleRound,
  registerStudentForDrive,
  getMyDriveRegistrations,
  getDriveRegistrations,
  updateRegistrationStatus,
} from '../controllers/driveController.js';

const router = Router();

// ─── Student Registration: My Registered Drives ──────────────────────────────
router.get(
  '/placement-drives/registrations/my',
  authenticate,
  authorize('STUDENT'),
  getMyDriveRegistrations
);

// ─── Placement Drives Collection ─────────────────────────────────────────────
router.get('/placement-drives', authenticate, getPlacementDrives);

router.post(
  '/placement-drives',
  authenticate,
  authorize('ADMIN'),
  validateDriveCreation,
  createPlacementDrive
);

// ─── Single Placement Drive by ID ────────────────────────────────────────────
router.get('/placement-drives/:id', authenticate, getPlacementDriveById);

router.put(
  '/placement-drives/:id',
  authenticate,
  authorize('ADMIN'),
  updatePlacementDrive
);

router.delete(
  '/placement-drives/:id',
  authenticate,
  authorize('ADMIN'),
  deletePlacementDrive
);

router.patch(
  '/placement-drives/:id/status',
  authenticate,
  authorize('ADMIN'),
  updateDriveStatus
);

// ─── Schedule Recruitment Rounds (Aptitude, Tech, HR) ────────────────────────
router.post(
  '/placement-drives/:id/rounds',
  authenticate,
  authorize('ADMIN'),
  validateRoundSchedule,
  scheduleRound
);

// ─── Student Drive Registration & Ineligibility Prevention ───────────────────
router.post(
  '/placement-drives/:id/register',
  authenticate,
  authorize('STUDENT'),
  registerStudentForDrive
);

// ─── Admin Registered Students Management ────────────────────────────────────
router.get(
  '/placement-drives/:id/registrations',
  authenticate,
  authorize('ADMIN'),
  getDriveRegistrations
);

router.patch(
  '/placement-drives/:id/registrations/:registrationId/status',
  authenticate,
  authorize('ADMIN'),
  updateRegistrationStatus
);

export default router;

