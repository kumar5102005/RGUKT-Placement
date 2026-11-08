/**
 * Role-Based Access Control (RBAC) Middleware
 * @param  {...string} roles Allowed roles (e.g. 'STUDENT', 'ADMIN', 'RECRUITER')
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required before role verification",
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Requires one of roles: [${roles.join(", ")}]. Current role: '${req.user.role}'`,
        },
      });
    }

    next();
  };
}

