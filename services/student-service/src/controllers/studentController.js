import { StudentProfile } from "../models/StudentProfile.js";
import { ResumeDocument } from "../models/ResumeDocument.js";
import { calculateProfileCompletion } from "../utils/completionCalculator.js";
import { createHash, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import path from "node:path";
import { resumeStorage } from "../storage/resumeStorage.js";

const COMPANY_DRIVE_SERVICE_URL =
  process.env.COMPANY_DRIVE_SERVICE_URL || "http://company-drive-service:4003";
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;
const RESUME_MIME_TYPES = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function hasExpectedResumeSignature(extension, buffer) {
  if (extension === ".pdf") {
    return buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"));
  }
  if (extension === ".doc") {
    return buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  }
  if (extension === ".docx") {
    return buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
  return false;
}

function findProfileByIdentifier(identifier) {
  const cleanId = String(identifier || "").trim();
  const queries = [
    { studentId: cleanId.toLowerCase() },
    { studentId: cleanId.toUpperCase() },
  ];
  if (/^[0-9a-fA-F]{24}$/.test(cleanId)) queries.unshift({ _id: cleanId });
  return StudentProfile.findOne({ $or: queries });
}

function findProfileResumeVersion(profile, fileName) {
  if (!profile || !fileName) return null;
  const versions = [
    ...(profile.resumeVersions || []),
    ...(profile.resumeFileName
      ? [{
          documentId: profile.resumeDocumentId || "",
          fileName: profile.resumeFileName,
          storageKey: profile.resumeFileName,
          originalName: profile.resumeOriginalName || profile.resumeFileName,
          mimeType: profile.resumeMimeType || "application/octet-stream",
          size: profile.resumeSize,
          uploadedAt: profile.resumeUploadedAt || null,
        }]
      : []),
  ];
  return versions.find((version) =>
    version.fileName === fileName || version.storageKey === fileName
  ) || null;
}

async function findResumeDocument(userId, { documentId, fileName }, profile) {
  let document = null;
  if (documentId) {
    if (!mongoose.isValidObjectId(documentId)) {
      return { error: { code: "RESUME_NOT_FOUND", message: "Resume document was not found." } };
    }
    document = await ResumeDocument.findOne({ _id: documentId, userId });
    if (!document) {
      return { error: { code: "RESUME_NOT_FOUND", message: "Resume document was not found." } };
    }
  } else {
    if (!fileName || path.basename(fileName) !== fileName) {
      return { error: { code: "RESUME_NOT_FOUND", message: "Resume document was not found." } };
    }
    document = await ResumeDocument.findOne({ userId, storageKey: fileName });
  }

  if (document) {
    if (!(await resumeStorage.exists(document.storageKey))) {
      return {
        error: {
          code: "RESUME_FILE_MISSING",
          message: "The original submitted document is unavailable in storage.",
        },
      };
    }
    return {
      documentId: String(document._id),
      storageKey: document.storageKey,
      fileName: document.storageKey,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      sha256: document.sha256,
      uploadedAt: document.uploadedAt,
    };
  }

  const legacyVersion = findProfileResumeVersion(profile, fileName);
  if (!legacyVersion) {
    return { error: { code: "RESUME_NOT_FOUND", message: "Resume document was not found." } };
  }
  const storageKey = legacyVersion.storageKey || legacyVersion.fileName;
  if (!(await resumeStorage.exists(storageKey))) {
    return {
      error: {
        code: "RESUME_FILE_MISSING",
        message: "The original submitted document is unavailable in storage.",
      },
    };
  }
  return {
    documentId: legacyVersion.documentId || "",
    storageKey,
    fileName: storageKey,
    originalName: legacyVersion.originalName || storageKey,
    mimeType: legacyVersion.mimeType || "application/octet-stream",
    size: legacyVersion.size || 0,
    sha256: legacyVersion.sha256 || "",
    uploadedAt: legacyVersion.uploadedAt || null,
  };
}

async function recordLegacyResumeDocument(userId, version) {
  if (version.documentId) return version.documentId;
  try {
    const document = await ResumeDocument.findOneAndUpdate(
      { userId, storageKey: version.storageKey },
      {
        $setOnInsert: {
          userId,
          storageKey: version.storageKey,
          originalName: version.originalName,
          mimeType: version.mimeType,
          size: version.size ?? null,
          sha256: version.sha256 || "",
          uploadedAt: version.uploadedAt || null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return String(document._id);
  } catch (error) {
    if (error.code !== 11000) throw error;
    const document = await ResumeDocument.findOne({ userId, storageKey: version.storageKey });
    if (!document) throw error;
    return String(document._id);
  }
}

async function resolveResumeVersion(userId, profile, requestedFileName, requestedDocumentId) {
  const fileName = requestedFileName || profile?.resumeFileName;
  return findResumeDocument(
    userId,
    { documentId: requestedDocumentId || (!requestedFileName ? profile?.resumeDocumentId : ""), fileName },
    profile
  );
}

async function sendResume(res, userId, profile, requestedFileName, requestedDocumentId) {
  const resolved = await resolveResumeVersion(
    userId,
    profile,
    requestedFileName,
    requestedDocumentId
  );
  if (resolved.error) {
    return res.status(404).json({ success: false, error: resolved.error });
  }
  const { fileName, storageKey, originalName, mimeType } = resolved;
  const contentType = mimeType || "application/octet-stream";
  res.set({
    "Content-Type": contentType,
    "Content-Disposition": `${contentType === "application/pdf" ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(originalName || fileName)}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  const stream = await resumeStorage.getObject(storageKey);
  return stream.pipe(res);
}

function getProfileConflict(error) {
  if (error.code !== 11000) return null;
  return error.keyPattern?.studentId
    ? {
        code: "STUDENT_ID_ALREADY_LINKED",
        message: "This student ID is already linked to another profile.",
      }
    : {
        code: "PROFILE_ALREADY_EXISTS",
        message: "A profile is already linked to this authenticated account.",
      };
}

/**
 * Safely extract and normalize the student's college ID without ever generating fake values.
 */
function resolveStudentId(req) {
  const studentId = String(req.user?.studentId || "").trim().toLowerCase();
  return /^o\d{6}$/.test(studentId) ? studentId : null;
}

async function findOwnProfile(req, studentId) {
  const userId = String(req.user.id);
  let profile = await StudentProfile.findOne({ userId });
  if (!profile && studentId) {
    profile = await StudentProfile.findOne({ studentId });
    if (profile && profile.userId !== userId) {
      const error = new Error("This student ID is already linked to another account.");
      error.code = "STUDENT_ID_ALREADY_LINKED";
      throw error;
    }
  }
  return profile;
}

/**
 * Get the authenticated student's profile
 * GET /api/v1/students/profile
 */
export async function getOwnProfile(req, res) {
  try {
    const studentId = resolveStudentId(req);
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "STUDENT_ID_REQUIRED",
          message: "A valid RGUKT student ID is required in the authenticated account.",
        },
      });
    }

    let profile = await findOwnProfile(req, studentId);

    // Automatically initialize a draft profile if not existing
    if (!profile) {
      profile = new StudentProfile({
        userId: req.user.id,
        studentId,
        fullName: req.user.fullName || "Student",
        email: req.user.email,
        verificationStatus: "PENDING",
      });
      profile.completionPercentage = calculateProfileCompletion(profile);
      await profile.save();
    } else {
      let changed = false;
      if (profile.studentId?.trim().toLowerCase() !== studentId && !/^o\d{6}$/i.test(profile.studentId || "")) {
        profile.studentId = studentId;
        changed = true;
      }
      if (profile.studentId?.trim().toLowerCase() !== studentId) {
        return res.status(409).json({
          success: false,
          error: {
            code: "STUDENT_ID_MISMATCH",
            message: "The student ID on this profile differs from the authenticated account. Contact TPO administration to resolve it.",
          },
        });
      }
      if (req.user.fullName && (!profile.fullName || profile.fullName === "RGUKT Student")) {
        profile.fullName = req.user.fullName;
        changed = true;
      }
      if (req.user.email && !profile.email) {
        profile.email = req.user.email.toLowerCase();
        changed = true;
      }

      // Refresh completion percentage
      const newCompletion = calculateProfileCompletion(profile);
      if (profile.completionPercentage !== newCompletion) {
        profile.completionPercentage = newCompletion;
        changed = true;
      }

      if (changed) {
        await profile.save();
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        profile,
      },
    });
  } catch (error) {
    if (error.code === "STUDENT_ID_ALREADY_LINKED") {
      return res.status(409).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    const profileConflict = getProfileConflict(error);
    if (profileConflict) {
      return res.status(409).json({ success: false, error: profileConflict });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: "PROFILE_FETCH_FAILED",
        message: "Failed to retrieve student profile",
        details: error.message,
      },
    });
  }
}

/**
 * Update authenticated student's profile
 * PUT /api/v1/students/profile
 */
export async function updateOwnProfile(req, res) {
  try {
    const studentId = resolveStudentId(req);
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: "STUDENT_ID_REQUIRED",
          message: "A valid RGUKT student ID is required in the authenticated account.",
        },
      });
    }

    let profile = await findOwnProfile(req, studentId);

    if (!profile) {
      profile = new StudentProfile({
        userId: req.user.id,
        studentId,
        email: req.user.email,
        fullName: req.body.fullName || req.user.fullName,
      });
    } else if (profile.studentId?.trim().toLowerCase() !== studentId && !/^o\d{6}$/i.test(profile.studentId || "")) {
      profile.studentId = studentId;
    } else if (profile.studentId?.trim().toLowerCase() !== studentId) {
      return res.status(409).json({
        success: false,
        error: {
          code: "STUDENT_ID_MISMATCH",
          message: "The student ID on this profile differs from the authenticated account. Contact TPO administration to resolve it.",
        },
      });
    }

    const {
      fullName,
      phone,
      gender,
      dateOfBirth,
      branch,
      batchYear,
      tenthPercentage,
      pucCgpa,
      btechCgpa,
      activeBacklogs,
      backlogHistory,
      semesters,
      technicalSkills,
      nonTechnicalSkills,
      projects,
      certifications,
      linkedinUrl,
      githubUrl,
      portfolioUrl,
    } = req.body;

    // Updatable fields
    if (fullName) profile.fullName = fullName.trim();
    if (phone !== undefined) profile.phone = phone ? phone.trim() : "";
    if (gender !== undefined) profile.gender = gender;
    if (dateOfBirth !== undefined) profile.dateOfBirth = dateOfBirth;

    // Academic updates
    if (branch !== undefined) profile.branch = branch || undefined;
    for (const [field, value] of Object.entries({
      batchYear,
      tenthPercentage,
      pucCgpa,
      btechCgpa,
      activeBacklogs,
      backlogHistory,
    })) {
      if (value !== undefined) {
        profile[field] = value === null || value === '' ? undefined : Number(value);
      }
    }

    if (Array.isArray(semesters)) {
      profile.semesters = semesters.map((s) => ({
        semesterNumber: Number(s.semesterNumber),
        sgpa: Number(s.sgpa) || 0,
        creditsCompleted: Number(s.creditsCompleted) || 0,
        hasBacklog: Boolean(s.hasBacklog),
      }));
    }

    // Skills
    if (Array.isArray(technicalSkills)) {
      profile.technicalSkills = technicalSkills.map((s) => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(nonTechnicalSkills)) {
      profile.nonTechnicalSkills = nonTechnicalSkills.map((s) => String(s).trim()).filter(Boolean);
    }

    // Projects & Certifications
    if (Array.isArray(projects)) {
      profile.projects = projects;
    }
    if (Array.isArray(certifications)) {
      profile.certifications = certifications;
    }

    // Links
    if (linkedinUrl !== undefined) profile.linkedinUrl = linkedinUrl ? linkedinUrl.trim() : "";
    if (githubUrl !== undefined) profile.githubUrl = githubUrl ? githubUrl.trim() : "";
    if (portfolioUrl !== undefined) profile.portfolioUrl = portfolioUrl ? portfolioUrl.trim() : "";

    // If student modifies critical academic fields, set verification to PENDING
    if (btechCgpa !== undefined || activeBacklogs !== undefined || branch !== undefined) {
      if (profile.verificationStatus === "VERIFIED") {
        profile.verificationStatus = "PENDING";
        profile.verificationNotes = "Profile modified after verification. Awaiting re-verification.";
      }
    }

    // Recalculate completion
    profile.completionPercentage = calculateProfileCompletion(profile);

    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Student profile updated successfully",
      data: {
        profile,
      },
    });
  } catch (error) {
    if (error.code === "STUDENT_ID_ALREADY_LINKED") {
      return res.status(409).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    const profileConflict = getProfileConflict(error);
    if (profileConflict) {
      return res.status(409).json({ success: false, error: profileConflict });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: "PROFILE_UPDATE_FAILED",
        message: "Failed to update profile",
        details: error.message,
      },
    });
  }
}

/**
 * Handle resume file upload
 * POST /api/v1/students/profile/resume
 */
export async function uploadResumeFile(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        error: {
          code: "FILE_REQUIRED",
          message: "No resume file was uploaded. Please attach a PDF, DOC, or DOCX document.",
        },
      });
    }

    const studentId = resolveStudentId(req);
    const orQueries = [{ userId: req.user.id }];
    if (studentId) {
      orQueries.push({ studentId }, { studentId: studentId.toUpperCase() });
    }

    let profile = await StudentProfile.findOne({ $or: orQueries });

    if (!profile) {
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: "STUDENT_ID_REQUIRED",
            message: "Student ID is required before uploading a resume.",
          },
        });
      }

      profile = new StudentProfile({
        userId: req.user.id,
        studentId,
        email: req.user.email,
        fullName: req.user.fullName || "RGUKT Student",
        branch: "CSE",
        batchYear: new Date().getFullYear(),
      });
    } else if (studentId && profile.studentId !== studentId) {
      profile.studentId = studentId;
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    const mimeType = RESUME_MIME_TYPES[extension];
    if (!mimeType) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FILE_TYPE", message: "Only PDF, DOC, and DOCX resumes are allowed." },
      });
    }
    if (!hasExpectedResumeSignature(extension, req.file.buffer)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "FILE_CONTENT_MISMATCH",
          message: "The uploaded file contents do not match its PDF, DOC, or DOCX extension.",
        },
      });
    }

    const originalName = path.basename(String(req.file.originalname).replace(/\\/g, "/"))
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .slice(0, 255) || `resume${extension}`;
    const sha256 = createHash("sha256").update(req.file.buffer).digest("hex");
    const userId = String(profile.userId);
    let document = await ResumeDocument.findOne({
      userId,
      sha256,
      size: req.file.size,
    });
    if (document && !(await resumeStorage.exists(document.storageKey))) {
      document = null;
    }
    if (!document) {
      const storageKey = `${randomUUID()}${extension}`;
      await resumeStorage.putObject({
        key: storageKey,
        body: req.file.buffer,
        contentType: mimeType,
      });
      document = await ResumeDocument.create({
        userId,
        storageKey,
        originalName,
        mimeType,
        size: req.file.size,
        sha256,
        uploadedAt: new Date(),
      });
    }

    if (
      profile.resumeFileName &&
      !(profile.resumeVersions || []).some((version) => version.fileName === profile.resumeFileName)
    ) {
      const previousDocument = await ResumeDocument.findOne({
        userId,
        storageKey: profile.resumeFileName,
      });
      profile.resumeVersions.push({
        documentId: profile.resumeDocumentId || (previousDocument ? String(previousDocument._id) : ""),
        fileName: profile.resumeFileName,
        storageKey: profile.resumeFileName,
        originalName: profile.resumeOriginalName || profile.resumeFileName,
        mimeType: profile.resumeMimeType || "application/octet-stream",
        size: profile.resumeSize,
        uploadedAt: profile.resumeUploadedAt || null,
      });
    }
    profile.resumeDocumentId = String(document._id);
    profile.resumeUrl = `/api/v1/students/${encodeURIComponent(profile.studentId)}/resume`;
    profile.resumeFileName = document.storageKey;
    profile.resumeOriginalName = document.originalName;
    profile.resumeMimeType = document.mimeType;
    profile.resumeSize = document.size;
    profile.resumeUploadedAt = document.uploadedAt;

    profile.completionPercentage = calculateProfileCompletion(profile);
    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      data: {
        resumeUrl: profile.resumeUrl,
        resumeDocumentId: profile.resumeDocumentId,
        originalName: document.originalName,
        sizeBytes: document.size,
        completionPercentage: profile.completionPercentage,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "RESUME_UPLOAD_FAILED",
        message: "Failed to process resume file upload",
        details: error.message,
      },
    });
  }
}

export async function getOwnResume(req, res) {
  try {
    const userId = String(req.user.id);
    const profile = await StudentProfile.findOne({ userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student profile was not found." },
      });
    }
    return await sendResume(res, userId, profile);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "RESUME_READ_FAILED", message: "Unable to retrieve resume." },
    });
  }
}

export async function getStudentResume(req, res) {
  try {
    const profile = await findProfileByIdentifier(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student record was not found." },
      });
    }
    if (req.user.role !== "ADMIN" && String(profile.userId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access denied to this resume." },
      });
    }
    return await sendResume(res, String(profile.userId), profile);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "RESUME_READ_FAILED", message: "Unable to retrieve resume." },
    });
  }
}

export async function getInternalResume(req, res) {
  try {
    const userId = String(req.params.id);
    const documentId = req.query.documentId ? String(req.query.documentId) : "";
    const fileName = req.query.fileName ? String(req.query.fileName) : undefined;
    const profile = documentId ? null : await StudentProfile.findOne({ userId });
    if (!documentId && !profile) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student record was not found." },
      });
    }
    return await sendResume(res, userId, profile, fileName, documentId);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "RESUME_READ_FAILED", message: "Unable to retrieve resume." },
    });
  }
}

export async function getInternalResumeReference(req, res) {
  try {
    const userId = String(req.params.id);
    const documentId = req.query.documentId ? String(req.query.documentId) : "";
    const fileName = req.query.fileName ? String(req.query.fileName) : undefined;
    const profile = documentId ? null : await StudentProfile.findOne({ userId });
    if (!documentId && !profile) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student record was not found." },
      });
    }

    const resolved = await resolveResumeVersion(userId, profile, fileName, documentId);
    if (resolved.error) {
      return res.status(404).json({ success: false, error: resolved.error });
    }
    const registeredDocumentId = await recordLegacyResumeDocument(userId, resolved);
    return res.status(200).json({
      success: true,
      data: {
        available: true,
        ownerUserId: userId,
        documentId: registeredDocumentId,
        storageKey: resolved.storageKey,
        originalName: resolved.originalName,
        mimeType: resolved.mimeType,
        size: resolved.size,
        sha256: resolved.sha256,
        uploadedAt: resolved.uploadedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "RESUME_READ_FAILED", message: "Unable to validate resume reference." },
    });
  }
}

/**
 * Check academic eligibility for recruitment drives
 * GET /api/v1/students/eligibility-check
 */
export async function checkEligibility(req, res) {
  try {
    const { minCgpa, allowedBranches, maxBacklogs, eligibleBatchYear } = req.query;
    if (!SERVICE_API_KEY) {
      return res.status(503).json({
        success: false,
        error: {
          code: "SERVICE_CONFIGURATION_ERROR",
          message: "Eligibility service authorization is not configured.",
        },
      });
    }

    const eligibilityCriteria = {};
    if (minCgpa !== undefined) eligibilityCriteria.minCgpa = minCgpa;
    if (allowedBranches) {
      eligibilityCriteria.allowedBranches = allowedBranches.split(",").map((branch) => branch.trim());
    }
    if (maxBacklogs !== undefined) eligibilityCriteria.maxActiveBacklogs = maxBacklogs;

    const response = await fetch(`${COMPANY_DRIVE_SERVICE_URL}/api/v1/jobs/internal/eligibility-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": SERVICE_API_KEY,
      },
      body: JSON.stringify({
        studentUserId: req.user.id,
        eligibilityCriteria,
        eligibleBatchYear,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      return res.status(response.status || 502).json({
        success: false,
        error: result.error || {
          code: "ELIGIBILITY_SERVICE_ERROR",
          message: "Eligibility service request failed.",
        },
      });
    }

    const { student, evaluation } = result.data;
    const checks = {
      cgpaEligible: evaluation.criteria.cgpa?.passed ?? null,
      branchEligible: evaluation.criteria.branch?.passed ?? null,
      backlogsEligible: evaluation.criteria.activeBacklogs?.passed ?? null,
      batchEligible: evaluation.criteria.graduationYear?.passed ?? null,
      verifiedProfile: student.verificationStatus === "VERIFIED",
    };

    return res.status(200).json({
      success: true,
      data: {
        isEligible: evaluation.isEligible,
        status: evaluation.status,
        eligible: evaluation.eligible,
        evaluation,
        checks,
        reasons: evaluation.reasons,
        academicSnapshot: {
          studentId: student.studentId,
          fullName: student.fullName,
          branch: student.branch,
          batchYear: student.batchYear,
          btechCgpa: student.btechCgpa,
          activeBacklogs: student.activeBacklogs,
          backlogHistory: student.backlogHistory,
          tenthPercentage: student.tenthPercentage,
          pucCgpa: student.pucCgpa,
          gender: student.gender,
          verificationStatus: student.verificationStatus,
          hasResume: Boolean(student.resumeUrl),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "ELIGIBILITY_CHECK_FAILED",
        message: "Failed to evaluate academic eligibility",
      },
    });
  }
}

/**
 * Search students with filtering and pagination (Admin only)
 * GET /api/v1/students/search
 */
export async function searchStudents(req, res) {
  try {
    const {
      search,
      branch,
      minCgpa,
      maxCgpa,
      maxBacklogs,
      batchYear,
      verificationStatus,
      placementStatus,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { studentId: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (branch) filter.branch = branch;
    if (batchYear) filter.batchYear = Number(batchYear);
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (placementStatus) filter.placementStatus = placementStatus;

    if (minCgpa !== undefined || maxCgpa !== undefined) {
      filter.btechCgpa = {};
      if (minCgpa !== undefined) filter.btechCgpa.$gte = Number(minCgpa);
      if (maxCgpa !== undefined) filter.btechCgpa.$lte = Number(maxCgpa);
    }

    if (maxBacklogs !== undefined) {
      filter.activeBacklogs = { $lte: Number(maxBacklogs) };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [students, total] = await Promise.all([
      StudentProfile.find(filter)
        .sort({ btechCgpa: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      StudentProfile.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        students,
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
        code: "STUDENT_SEARCH_FAILED",
        message: "Failed to search student profiles",
        details: error.message,
      },
    });
  }
}

/**
 * Get full profile by ID (Admin only)
 * GET /api/v1/students/:id
 */
export async function getStudentById(req, res) {
  try {
    const { id } = req.params;
    const cleanId = String(id).trim();

    const profile = await StudentProfile.findOne({
      $or: [
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null },
        { studentId: cleanId.toLowerCase() },
        { studentId: cleanId.toUpperCase() },
      ],
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student record was not found" },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        profile,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "STUDENT_FETCH_FAILED", message: error.message },
    });
  }
}

/**
 * Verify or Reject student profile (Admin only)
 * PATCH /api/v1/students/:id/verify
 */
export async function verifyStudentProfile(req, res) {
  try {
    const { id } = req.params;
    const { verificationStatus, verificationNotes } = req.body;

    if (!["VERIFIED", "REJECTED", "PENDING"].includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: "verificationStatus must be 'VERIFIED', 'REJECTED', or 'PENDING'",
        },
      });
    }

    const cleanId = String(id).trim();
    if (!/^[0-9a-fA-F]{24}$/.test(cleanId)) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student record was not found" },
      });
    }
    const profile = await StudentProfile.findById(cleanId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student record was not found" },
      });
    }

    profile.verificationStatus = verificationStatus;
    profile.verifiedBy = String(req.user?.id || req.user?._id || "");
    profile.verifiedAt = new Date();
    if (verificationNotes !== undefined) profile.verificationNotes = verificationNotes;

    await profile.save();

    return res.status(200).json({
      success: true,
      message: `Student profile marked as ${verificationStatus}`,
      data: {
        profile,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "VERIFICATION_FAILED", message: error.message },
    });
  }
}

/**
 * Internal Microservice Query for academic credentials
 * GET /api/v1/students/internal/:id
 */
export async function getInternalStudentData(req, res) {
  try {
    const { id } = req.params;
    const cleanId = String(id).trim();

    const profile = await StudentProfile.findOne({
      $or: [
        { _id: cleanId.match(/^[0-9a-fA-F]{24}$/) ? cleanId : null },
        { studentId: cleanId.toLowerCase() },
        { studentId: cleanId.toUpperCase() },
        { userId: cleanId },
      ],
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: "STUDENT_NOT_FOUND", message: "Student record was not found" },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        studentId: profile.studentId,
        userId: profile.userId,
        fullName: profile.fullName,
        email: profile.email,
        branch: profile.branch,
        batchYear: profile.batchYear,
        tenthPercentage: profile.tenthPercentage,
        pucCgpa: profile.pucCgpa,
        btechCgpa: profile.btechCgpa,
        activeBacklogs: profile.activeBacklogs,
        backlogHistory: profile.backlogHistory,
        gender: profile.gender,
        technicalSkills: profile.technicalSkills,
        nonTechnicalSkills: profile.nonTechnicalSkills,
        resumeUrl: profile.resumeFileName
          ? `/api/v1/students/${encodeURIComponent(profile.studentId)}/resume`
          : "",
        resumeFileName: profile.resumeFileName || "",
        resumeDocumentId: profile.resumeDocumentId || "",
        resumeStorageKey: profile.resumeFileName || "",
        resumeOriginalName: profile.resumeOriginalName || "",
        resumeMimeType: profile.resumeMimeType || "",
        verificationStatus: profile.verificationStatus,
        placementStatus: profile.placementStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { code: "INTERNAL_QUERY_FAILED", message: error.message },
    });
  }
}
