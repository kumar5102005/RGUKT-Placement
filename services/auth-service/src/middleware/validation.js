/**
 * Input validation helpers for Auth Service
 */

const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
const ALLOWED_ROLES = ["STUDENT", "ADMIN", "RECRUITER"];
const ALLOWED_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_APPROVAL"];

export function validateRegister(req, res, next) {
  const { email, password, fullName, role, studentId, companyName } = req.body;
  const effectiveRole = role || "STUDENT";

  const errors = [];

  if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
    errors.push("A valid email address is required");
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  } else if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(password)) {
    errors.push("Password must contain at least one letter and one number");
  }

  if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
    errors.push("Full name must be at least 2 characters long");
  }

  if (role && !ALLOWED_ROLES.includes(role)) {
    errors.push(`Role must be one of: ${ALLOWED_ROLES.join(", ")}`);
  }

  if (effectiveRole === "STUDENT") {
    if (!studentId || !String(studentId).trim()) {
      errors.push("Student ID is required for student registration");
    } else if (!/^o\d{6}$/i.test(String(studentId).trim())) {
      errors.push("Student ID must follow RGUKT format (e.g., o210524)");
    }
  }

  if (effectiveRole === "RECRUITER" &&
      (typeof companyName !== "string" || companyName.trim().length < 2)) {
    errors.push("Company name is required for Recruiter registration");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid registration payload",
        details: errors,
      },
    });
  }

  next();
}

export function validateLogin(req, res, next) {
  const { email, password } = req.body;

  const errors = [];
  if (!email || !EMAIL_REGEX.test(String(email).trim())) {
    errors.push("A valid email is required");
  }
  if (!password || typeof password !== "string") {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid login credentials provided",
        details: errors,
      },
    });
  }

  next();
}

export function validateStatusUpdate(req, res, next) {
  const { status } = req.body;

  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      },
    });
  }

  next();
}
