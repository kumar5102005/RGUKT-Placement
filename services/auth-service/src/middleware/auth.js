import { verifyAccessToken } from "../utils/security.js";
import { User } from "../models/User.js";

export function requireInternalServiceKey(req, res, next) {
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey || req.get("x-service-key") !== serviceKey) {
    return res.status(403).json({
      success: false,
      error: { code: "INVALID_SERVICE_KEY", message: "Internal service authorization failed" },
    });
  }
  next();
}

/**
 * Authentication Middleware: Validates JWT access token
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authorization token missing or invalid format. Expected 'Bearer <token>'",
        },
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_EXPIRED_OR_INVALID",
          message: "Access token is invalid or has expired",
        },
      });
    }

    // Verify user exists and is active in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User associated with this token no longer exists",
        },
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        error: {
          code: "ACCOUNT_INACTIVE",
          message: `Your account is currently ${user.status.toLowerCase()}. Please contact TPO administration.`,
        },
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      studentId: user.studentId,
      companyName: user.companyName,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Failed to authenticate request",
        details: error.message,
      },
    });
  }
}
