import { StudentProfile } from "../models/StudentProfile.js";
import { calculateProfileCompletion } from "../utils/completionCalculator.js";

const COMPANY_DRIVE_SERVICE_URL =
  process.env.COMPANY_DRIVE_SERVICE_URL || "http://company-drive-service:4003";
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

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
    if (!req.file) {
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

    const fileRelativePath = `/uploads/resumes/${req.file.filename}`;

    profile.resumeUrl = fileRelativePath;
    profile.resumeFileName = req.file.filename;
    profile.resumeOriginalName = req.file.originalname;
    profile.resumeMimeType = req.file.mimetype;
    profile.resumeSize = req.file.size;
    profile.resumeUploadedAt = new Date();

    profile.completionPercentage = calculateProfileCompletion(profile);
    await profile.save();

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      data: {
        resumeUrl: fileRelativePath,
        originalName: req.file.originalname,
        sizeBytes: req.file.size,
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

    profile.verificationStatus = verificationStatus;
    profile.verifiedBy = req.user?.email || "TPO Administrator";
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
        resumeUrl: profile.resumeUrl,
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
