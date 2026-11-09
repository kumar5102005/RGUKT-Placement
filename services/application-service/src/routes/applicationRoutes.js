import { Router } from 'express';
import { authenticate, authorize, requireInternalServiceKey } from '../middleware/auth.js';
import {
  validateApplicationSubmission,
  validateStageTransition,
  validateInterviewSchedule,
} from '../middleware/applicationValidation.js';
import {
  applyForJob,
  getMyApplications,
  getApplications,
  getApplicationById,
  getApplicationResume,
  updateApplicationStage,
  scheduleInterview,
  submitInterviewEvaluation,
  updatePlacementOffer,
  getWorkflowStages,
  createCustomStage,
  syncJobRecruitmentRounds,
} from '../controllers/applicationController.js';

const router = Router();

router.put('/internal/jobs/:jobId/recruitment-rounds', requireInternalServiceKey, syncJobRecruitmentRounds);

// ─── Workflow Stages (Standard & Configurable) ──────────────────────────────
router.get('/stages', authenticate, getWorkflowStages);
router.post('/stages', authenticate, authorize('ADMIN'), createCustomStage);

// ─── Student Applications ───────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('STUDENT'),
  validateApplicationSubmission,
  applyForJob
);
router.get('/my', authenticate, authorize('STUDENT'), getMyApplications);

// ─── Recruiter & Admin Management ───────────────────────────────────────────
router.get('/', authenticate, authorize('RECRUITER', 'ADMIN'), getApplications);
router.get('/:id/resume', authenticate, getApplicationResume);
router.get('/:id', authenticate, getApplicationById);

// ─── Stage Transitions & Shortlisting ───────────────────────────────────────
router.patch(
  '/:id/stage',
  authenticate,
  authorize('RECRUITER'),
  validateStageTransition,
  updateApplicationStage
);

// ─── Interview Management ───────────────────────────────────────────────────
router.post(
  '/:id/interviews',
  authenticate,
  authorize('RECRUITER'),
  validateInterviewSchedule,
  scheduleInterview
);

router.patch(
  '/:id/interviews/:roundNumber/evaluation',
  authenticate,
  authorize('RECRUITER'),
  submitInterviewEvaluation
);

// ─── Final Placement Status & Offer ─────────────────────────────────────────
router.patch(
  '/:id/offer',
  authenticate,
  authorize('RECRUITER'),
  updatePlacementOffer
);

export default router;
