import { Router } from 'express';
import { authenticate, authorize, requireInternalServiceKey } from '../middleware/auth.js';
import { validateJobCreation, validateJobUpdate } from '../middleware/jobValidation.js';
import {
  createJob,
  getJobs,
  getRecruiterJobs,
  getJobById,
  updateJob,
  deleteJob,
  updateJobStatus,
  checkEligibility,
  getInternalJobData,
} from '../controllers/jobController.js';

const router = Router();

// ─── Internal Service-to-Service Query ──────────────────────────────────────
router.get('/internal/:id', requireInternalServiceKey, getInternalJobData);

// ─── Recruiter specific: list own company's jobs ─────────────────────────────
router.get('/my', authenticate, authorize('RECRUITER'), getRecruiterJobs);

// ─── Public / Authenticated search and listing ──────────────────────────────
router.get('/', authenticate, getJobs);

// ─── Create new job ──────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('RECRUITER', 'ADMIN'),
  validateJobCreation,
  createJob
);

// ─── Single Job Details ──────────────────────────────────────────────────────
router.get('/:id', authenticate, getJobById);

// ─── Update Job ──────────────────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  authorize('RECRUITER', 'ADMIN'),
  validateJobUpdate,
  updateJob
);

// ─── Delete Job ──────────────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('RECRUITER', 'ADMIN'), deleteJob);

// ─── Update Status ───────────────────────────────────────────────────────────
router.patch(
  '/:id/status',
  authenticate,
  authorize('RECRUITER', 'ADMIN'),
  updateJobStatus
);

// ─── Check Candidate Eligibility ─────────────────────────────────────────────
router.post('/:id/check-eligibility', authenticate, checkEligibility);

export default router;

