import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

/**
 * Authenticate JWT tokens
 */
export function authenticate(req, res, next) {
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

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: {
        code: "TOKEN_INVALID_OR_EXPIRED",
        message: "The provided token is invalid or expired",
      },
    });
  }
}

/**
 * Role-Based Access Control
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Requires one of roles: [${roles.join(", ")}]. Current: '${req.user.role}'`,
        },
      });
    }

    next();
  };
}

/**
 * Validate internal service-to-service key (for Application Service eligibility calls)
 */
export function requireInternalServiceKey(req, res, next) {
  const serviceKey = req.headers["x-service-key"];
  if (!serviceKey || serviceKey !== SERVICE_API_KEY) {
    return res.status(403).json({
      success: false,
      error: {
        code: "INVALID_SERVICE_KEY",
        message: "Unauthorized internal service call",
      },
    });
  }
  next();
}
