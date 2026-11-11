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
  checkInternalJobEligibility,
  checkInternalEligibility,
  getInternalJobData,
  getInternalRecruiterCompany,
  getInternalRecruitmentAccess,
} from '../controllers/jobController.js';

const router = Router();

// ─── Internal Service-to-Service Query ──────────────────────────────────────
router.get('/internal/:id', requireInternalServiceKey, getInternalJobData);
router.get('/internal/recruiters/:userId/company', requireInternalServiceKey, getInternalRecruiterCompany);
router.get('/internal/:id/recruitment-access/:userId', requireInternalServiceKey, getInternalRecruitmentAccess);
router.post('/internal/:id/check-eligibility', requireInternalServiceKey, checkInternalJobEligibility);
router.post('/internal/eligibility-check', requireInternalServiceKey, checkInternalEligibility);

// ─── Recruiter specific: list own company's jobs ─────────────────────────────
router.get('/my', authenticate, authorize('RECRUITER'), getRecruiterJobs);

// ─── Public / Authenticated search and listing ──────────────────────────────
router.get('/', authenticate, getJobs);

// ─── Create new job ──────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('RECRUITER'),
  validateJobCreation,
  createJob
);

// ─── Single Job Details ──────────────────────────────────────────────────────
router.get('/:id', authenticate, getJobById);

// ─── Update Job ──────────────────────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  authorize('RECRUITER'),
  validateJobUpdate,
  updateJob
);

// ─── Delete Job ──────────────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('RECRUITER'), deleteJob);

// ─── Update Status ───────────────────────────────────────────────────────────
router.patch(
  '/:id/status',
  authenticate,
  authorize('RECRUITER'),
  updateJobStatus
);

// ─── Check Candidate Eligibility ─────────────────────────────────────────────
router.post('/:id/check-eligibility', authenticate, authorize('STUDENT'), checkEligibility);

export default router;
