import { Router } from "express";
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateUserStatus,
  listUsers,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/rbac.js";
import {
  validateRegister,
  validateLogin,
  validateStatusUpdate,
} from "../middleware/validation.js";

const router = Router();

// ── Public Routes ─────────────────────────────────────────────────────────────
router.post("/register", validateRegister, register);
router.post("/login", validateLogin, login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);

// ── Protected Authenticated Routes ───────────────────────────────────────────
router.get("/me", authenticate, getMe);

// ── Role Protected Routes (Student / Recruiter / Admin) ────────────────────────
router.get("/student-portal", authenticate, authorize("STUDENT"), (req, res) => {
  res.status(200).json({
    success: true,
    message: `Welcome to Student Portal, ${req.user.fullName}!`,
    studentId: req.user.studentId,
  });
});

router.get("/recruiter-portal", authenticate, authorize("RECRUITER", "ADMIN"), (req, res) => {
  res.status(200).json({
    success: true,
    message: `Welcome to Recruiter Portal, ${req.user.fullName}!`,
    company: req.user.companyName,
  });
});

router.get("/admin-portal", authenticate, authorize("ADMIN"), (req, res) => {
  res.status(200).json({
    success: true,
    message: `Welcome to TPO Administration Console, ${req.user.fullName}!`,
  });
});

// ── Admin-Only User Management Routes ─────────────────────────────────────────
router.get("/users", authenticate, authorize("ADMIN"), listUsers);
router.patch("/users/:id/status", authenticate, authorize("ADMIN"), validateStatusUpdate, updateUserStatus);

export default router;

