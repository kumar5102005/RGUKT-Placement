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

// ─── Search (authenticated) ──────────────────────────────────────────────────
router.get('/search', authenticate, searchCompanies);

// ─── List all (authenticated) ────────────────────────────────────────────────
router.get('/', authenticate, getAllCompanies);

// ─── Single company (authenticated) ─────────────────────────────────────────
router.get('/:id', authenticate, getCompanyById);

// ─── Admin verification ──────────────────────────────────────────────────────
router.patch('/:id/verify', authenticate, authorize('ADMIN'), validateVerification, verifyCompany);

// ─── Admin recruiter management ──────────────────────────────────────────────
router.post(
  '/:id/recruiters',
  authenticate,
  authorize('ADMIN'),
  validateAddRecruiter,
  addRecruiter
);
router.delete('/:id/recruiters/:recruiterId', authenticate, authorize('ADMIN'), removeRecruiter);

export default router;

