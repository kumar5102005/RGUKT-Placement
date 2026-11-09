import { User } from "../models/User.js";
import { RefreshToken } from "../models/RefreshToken.js";
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
} from "../utils/security.js";

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
export async function register(req, res) {
  try {
    const { email, password, fullName, studentId, companyName } = req.body;
    const role = req.body.role || "STUDENT";
    const normalizedStudentId =
      role === "STUDENT" ? String(studentId).trim().toLowerCase() : undefined;

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: "USER_ALREADY_EXISTS",
          message: "An account with this email address already exists",
        },
      });
    }

    if (normalizedStudentId) {
      const existingStudentId = await User.findOne({ studentId: normalizedStudentId });
      if (existingStudentId) {
        return res.status(409).json({
          success: false,
          error: {
            code: "STUDENT_ID_EXISTS",
            message: "A student profile with this ID is already registered",
          },
        });
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      fullName: fullName.trim(),
      role,
      status: "ACTIVE",
      studentId: normalizedStudentId,
      companyName: companyName ? companyName.trim() : undefined,
      lastLoginAt: new Date(),
    });

    // Issue initial tokens
    const accessToken = generateAccessToken(user);
    const { token: newRefreshToken, expiresAt } = generateRefreshToken();

    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt,
      createdByIp: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: "Account registered successfully",
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          studentId: user.studentId,
          companyName: user.companyName,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateStudentId = Boolean(error.keyPattern?.studentId);
      return res.status(409).json({
        success: false,
        error: duplicateStudentId
          ? {
              code: "STUDENT_ID_EXISTS",
              message: "A student profile with this ID is already registered",
            }
          : {
              code: "USER_ALREADY_EXISTS",
              message: "An account with this email address already exists",
            },
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: "REGISTRATION_FAILED",
        message: "Failed to register account",
        details: error.message,
      },
    });
  }
}

/**
 * Authenticate user and issue tokens
 * POST /api/v1/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: {
          code: "ACCOUNT_NOT_ACTIVE",
          message: `Your account is ${user.status.toLowerCase()}. Access is restricted. Please contact TPO administration.`,
        },
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const { token: newRefreshToken, expiresAt } = generateRefreshToken();

    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt,
      createdByIp: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          studentId: user.studentId,
          companyName: user.companyName,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "LOGIN_FAILED",
        message: "Authentication process encountered an internal error",
        details: error.message,
      },
    });
  }
}

/**
 * Refresh access token using refresh token rotation
 * POST /api/v1/auth/refresh-token
 */
export async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: "TOKEN_REQUIRED",
          message: "Refresh token is required in request body",
        },
      });
    }

    const storedToken = await RefreshToken.findOne({ token });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Refresh token not found or invalid",
        },
      });
    }

    // Token Reuse Detection: If token is already revoked, someone is replaying it!
    if (storedToken.revoked) {
      // Invalidate all tokens for this user for security
      await RefreshToken.updateMany({ userId: storedToken.userId }, { revoked: true, revokedAt: new Date() });

      return res.status(403).json({
        success: false,
        error: {
          code: "TOKEN_COMPROMISED",
          message: "Attempted reuse of revoked refresh token. All active sessions have been invalidated for security.",
        },
      });
    }

    // Check expiration
    if (Date.now() >= storedToken.expiresAt.getTime()) {
      storedToken.revoked = true;
      storedToken.revokedAt = new Date();
      await storedToken.save();

      return res.status(401).json({
        success: false,
        error: {
          code: "REFRESH_TOKEN_EXPIRED",
          message: "Refresh token has expired. Please log in again.",
        },
      });
    }

    const user = await User.findById(storedToken.userId);
    if (!user || user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: {
          code: "USER_INACTIVE",
          message: "User account is no longer active",
        },
      });
    }

    // Rotate refresh token
    const { token: rotatedRefreshToken, expiresAt } = generateRefreshToken();

    storedToken.revoked = true;
    storedToken.revokedAt = new Date();
    storedToken.replacedByToken = rotatedRefreshToken;
    await storedToken.save();

    await RefreshToken.create({
      userId: user._id,
      token: rotatedRefreshToken,
      expiresAt,
      createdByIp: req.ip,
    });

    const newAccessToken = generateAccessToken(user);

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
        refreshToken: rotatedRefreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "REFRESH_FAILED",
        message: "Failed to rotate refresh token",
        details: error.message,
      },
    });
  }
}

/**
 * Logout and revoke refresh token
 * POST /api/v1/auth/logout
 */
export async function logout(req, res) {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      await RefreshToken.findOneAndUpdate(
        { token },
        { revoked: true, revokedAt: new Date() }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Logged out successfully. Session invalidated.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "LOGOUT_FAILED",
        message: "Failed to process logout",
        details: error.message,
      },
    });
  }
}

/**
 * Get current authenticated user context
 * GET /api/v1/auth/me
 */
export async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

/**
 * Update account status (Admin only)
 * PATCH /api/v1/auth/users/:id/status
 */
export async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User with specified ID does not exist",
        },
      });
    }

    user.status = status;
    await user.save();

    // If account suspended or inactive, revoke all active sessions
    if (status === "SUSPENDED" || status === "INACTIVE") {
      await RefreshToken.updateMany(
        { userId: user._id, revoked: false },
        { revoked: true, revokedAt: new Date() }
      );
    }

    return res.status(200).json({
      success: true,
      message: `Account status updated to '${status}' successfully`,
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "STATUS_UPDATE_FAILED",
        message: "Failed to update account status",
        details: error.message,
      },
    });
  }
}

/**
 * List all users with pagination and role filter (Admin only)
 * GET /api/v1/auth/users
 */
export async function listUsers(req, res) {
  try {
    const { role, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("-passwordHash"),
      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users,
      },
      meta: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "LIST_USERS_FAILED",
        message: "Failed to retrieve user list",
        details: error.message,
      },
    });
  }
}

export async function getInternalRecruiterByEmail(req, res) {
  try {
    const email = String(req.params.email || "").trim().toLowerCase();
    const user = await User.findOne({ email, role: "RECRUITER", status: "ACTIVE" }).select(
      "_id email fullName role status companyName"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: "RECRUITER_ACCOUNT_NOT_FOUND",
          message: "No active recruiter account exists for this email.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          status: user.status,
          companyName: user.companyName,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "RECRUITER_LOOKUP_FAILED",
        message: "Failed to verify recruiter account",
      },
    });
  }
}
