import mongoose from 'mongoose';

export const BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'MME'];
export const ROLE_CATEGORIES = ['Full-Time', 'Internship', 'Internship + PPO', 'Contract'];
export const WORKPLACE_TYPES = ['On-site', 'Hybrid', 'Remote'];
export const JOB_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED'];

const roundSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    mode: { type: String, enum: ['Online', 'In-Person', 'Hybrid'], default: 'Online' },
    scheduledDate: { type: Date, default: null },
    durationMinutes: { type: Number, min: 1, default: null },
    venueOrLink: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
    },
  }
);

const eligibilitySchema = new mongoose.Schema(
  {
    minCgpa: {
      type: Number,
      default: 6.0,
      min: [0, 'Minimum CGPA cannot be negative'],
      max: [10, 'Maximum CGPA cannot exceed 10'],
    },
    allowedBranches: {
      type: [String],
      enum: BRANCHES,
      default: [...BRANCHES],
    },
    eligibleBatchYears: {
      type: [Number],
      default: [2025, 2026],
    },
    maxActiveBacklogs: {
      type: Number,
      default: 0,
      min: [0, 'Backlogs cannot be negative'],
    },
    maxHistoryBacklogs: {
      type: Number,
      default: 2,
      min: [0, 'Backlogs cannot be negative'],
    },
    minTenthPercentage: {
      type: Number,
      default: 60,
      min: [0, 'Percentage must be at least 0'],
      max: [100, 'Percentage cannot exceed 100'],
    },
    minTwelfthPucCgpa: {
      type: Number,
      default: 6.0,
      min: [0, 'CGPA cannot be negative'],
      max: [10, 'CGPA cannot exceed 10'],
    },
    genderPreference: {
      type: String,
      enum: ['All', 'Female Only', 'Male Only'],
      default: 'All',
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const salarySchema = new mongoose.Schema(
  {
    minLpa: { type: Number, default: 0, min: 0 },
    maxLpa: { type: Number, default: 0, min: 0 },
    stipendPerMonth: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    breakup: { type: String, default: '' },
  },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    companyLogo: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      minlength: [3, 'Job title must be at least 3 characters'],
      maxlength: [150, 'Job title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
    },
    roleCategory: {
      type: String,
      enum: ROLE_CATEGORIES,
      default: 'Full-Time',
    },
    workplaceType: {
      type: String,
      enum: WORKPLACE_TYPES,
      default: 'On-site',
    },
    locations: {
      type: [String],
      default: ['Ongole', 'Hyderabad'],
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    preferredSkills: {
      type: [String],
      default: [],
    },
    salary: {
      type: salarySchema,
      default: () => ({}),
    },
    eligibility: {
      type: eligibilitySchema,
      default: () => ({}),
    },
    selectionRounds: {
      type: [roundSchema],
      default: [
        { roundNumber: 1, name: 'Online Aptitude & Coding Assessment', mode: 'Online' },
        { roundNumber: 2, name: 'Technical Interview', mode: 'Online' },
        { roundNumber: 3, name: 'HR & Cultural Fit Round', mode: 'In-Person' },
      ],
    },
    roundsSyncPending: {
      type: Boolean,
      default: false,
    },
    applicationDeadline: {
      type: Date,
      required: [true, 'Application deadline is required'],
    },
    driveDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: String,
      default: '',
    },
    createdBy: {
      type: String, // userId
      required: true,
      index: true,
    },
    createdByRole: {
      type: String,
      enum: ['RECRUITER', 'ADMIN'],
      default: 'RECRUITER',
    },
    totalApplicants: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// --- Compound & Text Indexes for High Performance Queries ---
jobSchema.index({ status: 1, applicationDeadline: 1 });
jobSchema.index({ companyId: 1, status: 1 });
jobSchema.index({ 'eligibility.allowedBranches': 1 });
jobSchema.index({ 'eligibility.eligibleBatchYears': 1 });
jobSchema.index({ 'eligibility.minCgpa': 1 });
jobSchema.index({ 'salary.minLpa': 1, 'salary.maxLpa': 1 });
jobSchema.index({
  title: 'text',
  companyName: 'text',
  description: 'text',
  requiredSkills: 'text',
});

// Auto-generate slug before save
jobSchema.pre('save', function (next) {
  if (this.isModified('title') || !this.slug) {
    const baseSlug = `${this.companyName}-${this.title}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    this.slug = `${baseSlug}-${Date.now().toString(36)}`;
  }
  next();
});

const Job = mongoose.model('Job', jobSchema);
export default Job;
