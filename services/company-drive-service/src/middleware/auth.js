import jwt from 'jsonwebtoken';

const JWT_SECRET =
  process.env.JWT_SECRET || 'rgukt_super_secure_jwt_secret_token_2026_dev_key';
const SERVICE_API_KEY =
  process.env.SERVICE_API_KEY || 'rgukt_placement_internal_secret_key_2026';

/**
 * Verifies JWT and attaches user payload to req.user.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'NO_TOKEN', message: 'Authentication token is required' },
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' },
      });
    }
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid authentication token' },
    });
  }
}

/**
 * RBAC middleware factory. Pass allowed roles as strings.
 * Usage: authorize('ADMIN', 'RECRUITER')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Please authenticate first' },
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role(s): ${roles.join(', ')}`,
        },
      });
    }
    next();
  };
}

/**
 * Verifies the internal service-to-service API key.
 * Requires x-service-key header matching SERVICE_API_KEY.
 */
export function requireInternalServiceKey(req, res, next) {
  const key = req.headers['x-service-key'];
  if (!key || key !== SERVICE_API_KEY) {
    return res.status(403).json({
      success: false,
      error: { code: 'INVALID_SERVICE_KEY', message: 'Internal service key is invalid' },
    });
  }
  next();
}

