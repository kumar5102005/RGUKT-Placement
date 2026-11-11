import mongoose from "mongoose";

const resumeDocumentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, immutable: true },
    storageKey: { type: String, required: true, unique: true, immutable: true },
    originalName: { type: String, required: true, immutable: true },
    mimeType: { type: String, required: true, immutable: true },
    size: { type: Number, immutable: true },
    sha256: { type: String, default: "", immutable: true },
    uploadedAt: { type: Date, immutable: true },
  },
  { timestamps: true }
);

export const ResumeDocument = mongoose.model("ResumeDocument", resumeDocumentSchema);
