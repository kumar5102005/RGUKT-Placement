import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "rgukt_super_secure_jwt_secret_token_2026_dev_key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const REFRESH_TOKEN_DAYS = 7;

/**
 * Hash password with bcrypt (salt rounds: 12)
 */
export async function hashPassword(plainTextPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainTextPassword, salt);
}

/**
 * Compare plain-text password with stored hash
 */
export async function comparePassword(plainTextPassword, hash) {
  if (!plainTextPassword || !hash) return false;
  return bcrypt.compare(plainTextPassword, hash);
}

/**
 * Generate short-lived JWT access token
 */
export function generateAccessToken(user) {
  const payload = {
    id: user._id ? user._id.toString() : user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    status: user.status,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

/**
 * Generate secure random refresh token and expiry date
 */
export function generateRefreshToken() {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

/**
 * Verify JWT access token
 */
// export function verifyAccessToken(token) {
//   try {
//     return jwt.verify(token, JWT_SECRET);
//   } catch (err) {
//     return null;
//   }
// }

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (err) {
    console.error("JWT Verification Failed:", {
      name: err.name,
      message: err.message,
    });

    return null;
  }
}

