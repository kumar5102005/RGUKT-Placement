import mongoose from "mongoose";

const semesterSchema = new mongoose.Schema(
  {
    semesterNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    sgpa: {
      type: Number,
      min: 0,
      max: 10,
    },
    creditsCompleted: {
      type: Number,
      min: 0,
    },
    hasBacklog: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    technologies: [
      {
        type: String,
        trim: true,
      },
    ],
    projectUrl: {
      type: String,
      trim: true,
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    startDate: Date,
    endDate: Date,
  },
  { _id: true }
);

const certificationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    issuingOrganization: {
      type: String,
      trim: true,
    },
    issueDate: Date,
    credentialUrl: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"],
      default: "PREFER_NOT_TO_SAY",
    },
    dateOfBirth: Date,

    // Academic Details
    branch: {
      type: String,
      enum: ["CSE", "ECE", "EEE", "MECH", "CIVIL", "CHEM", "MME"],
      required: true,
      index: true,
    },
    batchYear: {
      type: Number,
      required: true,
      index: true,
    },
    tenthPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    pucCgpa: {
      type: Number,
      min: 0,
      max: 10,
    },
    btechCgpa: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
      index: true,
    },
    activeBacklogs: {
      type: Number,
      min: 0,
      default: 0,
      index: true,
    },
    backlogHistory: {
      type: Number,
      min: 0,
      default: 0,
    },
    semesters: [semesterSchema],

    // Skills
    technicalSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    nonTechnicalSkills: [
      {
        type: String,
        trim: true,
      },
    ],

    // Projects & Certifications
    projects: [projectSchema],
    certifications: [certificationSchema],

    // Resume Document
    resumeUrl: {
      type: String,
      trim: true,
    },
    resumeFileName: String,
    resumeOriginalName: String,
    resumeMimeType: String,
    resumeSize: Number,
    resumeUploadedAt: Date,

    // Professional Profiles
    linkedinUrl: {
      type: String,
      trim: true,
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    portfolioUrl: {
      type: String,
      trim: true,
    },

    // Metrics & TPO Verification
    completionPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    verificationStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    verifiedBy: String,
    verifiedAt: Date,
    verificationNotes: String,
    placementStatus: {
      type: String,
      enum: ["NOT_PLACED", "PLACED", "OPTED_OUT"],
      default: "NOT_PLACED",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for administrator filtering
studentProfileSchema.index({ branch: 1, btechCgpa: -1 });
studentProfileSchema.index({ batchYear: 1, branch: 1, btechCgpa: -1 });
studentProfileSchema.index({ activeBacklogs: 1, btechCgpa: -1 });
studentProfileSchema.index({
  fullName: "text",
  studentId: "text",
  email: "text",
});

export const StudentProfile = mongoose.model("StudentProfile", studentProfileSchema);

