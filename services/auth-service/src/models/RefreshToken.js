import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index to auto-delete expired documents
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: {
      type: Date,
    },
    replacedByToken: {
      type: String,
    },
    createdByIp: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

refreshTokenSchema.methods.isActive = function () {
  return !this.revoked && Date.now() < this.expiresAt.getTime();
};

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

