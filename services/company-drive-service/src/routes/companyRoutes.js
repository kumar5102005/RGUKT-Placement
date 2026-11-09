import { Router } from 'express';
import { authenticate, authorize, requireInternalServiceKey } from '../middleware/auth.js';
import {
  validateCompanyRegistration,
  validateCompanyUpdate,
  validateVerification,
  validateAddRecruiter,
} from '../middleware/validation.js';
import {
  registerCompany,
  getOwnCompany,
  updateCompany,
  getAllCompanies,
  searchCompanies,
  getCompanyById,
  verifyCompany,
  addRecruiter,
  removeRecruiter,
  addOwnCompanyRecruiter,
  getOwnCompanyRecruiters,
  removeOwnCompanyRecruiter,
  toggleOwnCompanyRecruiterStatus,
  getInternalCompanyData,
} from '../controllers/companyController.js';

const router = Router();

// ─── Internal (service-to-service) ──────────────────────────────────────────
// MUST be before /:id to avoid conflict
router.get('/internal/:id', requireInternalServiceKey, getInternalCompanyData);

// ─── Recruiter routes ────────────────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('RECRUITER'),
  validateCompanyRegistration,
  registerCompany
);
router.get('/my', authenticate, authorize('RECRUITER'), getOwnCompany);
router.put('/my', authenticate, authorize('RECRUITER'), validateCompanyUpdate, updateCompany);
router.get('/my/recruiters', authenticate, authorize('RECRUITER'), getOwnCompanyRecruiters);
router.post('/my/recruiters', authenticate, authorize('RECRUITER'), validateAddRecruiter, addOwnCompanyRecruiter);
router.delete('/my/recruiters/:recruiterId', authenticate, authorize('RECRUITER'), removeOwnCompanyRecruiter);
router.patch('/my/recruiters/:recruiterId/status', authenticate, authorize('RECRUITER'), toggleOwnCompanyRecruiterStatus);

// ─── Search (authenticated) ──────────────────────────────────────────────────
router.get('/search', authenticate, searchCompanies);

// ─── List all (authenticated) ────────────────────────────────────────────────
router.get('/', authenticate, getAllCompanies);

// ─── Single company (authenticated) ─────────────────────────────────────────
router.get('/:id', authenticate, getCompanyById);

// ─── Admin verification ──────────────────────────────────────────────────────
router.patch('/:id/verify', authenticate, authorize('ADMIN'), validateVerification, verifyCompany);

// ─── Recruiter management (Admin or Company Recruiter) ────────────────────────
router.post(
  '/:id/recruiters',
  authenticate,
  authorize('ADMIN', 'RECRUITER'),
  validateAddRecruiter,
  addRecruiter
);
router.delete('/:id/recruiters/:recruiterId', authenticate, authorize('ADMIN', 'RECRUITER'), removeRecruiter);

export default router;

