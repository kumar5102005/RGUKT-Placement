import { Router } from "express";
import {
  getOwnProfile,
  updateOwnProfile,
  uploadResumeFile,
  checkEligibility,
  searchStudents,
  getStudentById,
  verifyStudentProfile,
  getInternalStudentData,
} from "../controllers/studentController.js";
import {
  authenticate,
  authorize,
  requireInternalServiceKey,
} from "../middleware/auth.js";
import { uploadResume } from "../middleware/upload.js";

const router = Router();

// ── Student Self-Management Routes ───────────────────────────────────────────
router.get("/profile", authenticate, getOwnProfile);
router.put("/profile", authenticate, updateOwnProfile);
router.post("/profile/resume", authenticate, uploadResume.single("resume"), uploadResumeFile);
router.get("/eligibility-check", authenticate, checkEligibility);

// ── Administrator Search & Verification Routes ────────────────────────────────
router.get("/search", authenticate, authorize("ADMIN"), searchStudents);
router.get("/:id", authenticate, authorize("ADMIN"), getStudentById);
router.patch("/:id/verify", authenticate, authorize("ADMIN"), verifyStudentProfile);

// ── Internal Microservice Sync Route ──────────────────────────────────────────
router.get("/internal/:id", requireInternalServiceKey, getInternalStudentData);

export default router;

