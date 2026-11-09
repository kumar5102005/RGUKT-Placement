import mongoose from 'mongoose';

export const BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'CHEM', 'MME'];
export const DRIVE_STATUSES = [
  'DRAFT',
  'UPCOMING',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];
export const ROUND_TYPES = [
  'APTITUDE',
  'TECHNICAL_INTERVIEW',
  'HR_INTERVIEW',
  'CODING_TEST',
  'GROUP_DISCUSSION',
  'OTHER',
];

const recruitmentRoundSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    roundType: {
      type: String,
      enum: ROUND_TYPES,
      required: true,
      default: 'APTITUDE',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    }, // e.g. "Online Aptitude & Reasoning Assessment", "Technical Interview I"
    description: { type: String, default: '' },
    mode: {
      type: String,
      enum: ['ONLINE', 'IN_PERSON', 'HYBRID'],
      default: 'ONLINE',
    },
    scheduledDate: { type: Date, default: null },
    durationMinutes: { type: Number, min: 1, default: null },
    venueOrLink: { type: String, default: '' }, // e.g. "Audi-2 / HackerEarth Link"
    instructions: { type: String, default: '' },
    qualificationCriteria: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
    },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: true }
);

const jobRoleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    packageLpa: { type: Number, default: 0 },
    stipend: { type: Number, default: 0 },
    locations: { type: [String], default: ['Ongole'] },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
  },
  { _id: false }
);

const placementDriveSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Drive title is required'],
      trim: true,
      minlength: [3, 'Drive title must be at least 3 characters'],
      maxlength: [200, 'Drive title cannot exceed 200 characters'],
    },
    driveCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Associated company is required'],
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
    academicYear: {
      type: String,
      default: '2025-2026',
      trim: true,
    },
    batchYear: {
      type: Number,
      default: 2026,
    },
    jobRoles: {
      type: [jobRoleSchema],
      default: [],
    },
    eligibilityCriteria: {
      minCgpa: {
        type: Number,
        default: 6.5,
        min: [0, 'Min CGPA cannot be negative'],
        max: [10, 'Max CGPA is 10'],
      },
      allowedBranches: {
        type: [String],
        enum: BRANCHES,
        default: [...BRANCHES],
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
        min: 0,
        max: 100,
      },
      minPucCgpa: {
        type: Number,
        default: 6.0,
        min: 0,
        max: 10,
      },
      eligibleGenders: {
        type: String,
        enum: ['ALL', 'MALE', 'FEMALE'],
        default: 'ALL',
      },
    },
    registrationWindow: {
      openDate: {
        type: Date,
        default: Date.now,
      },
      closeDate: {
        type: Date,
        required: [true, 'Registration deadline is required'],
      },
    },
    recruitmentRounds: {
      type: [recruitmentRoundSchema],
      default: [],
    },
    driveStatus: {
      type: String,
      enum: DRIVE_STATUSES,
      default: 'REGISTRATION_OPEN',
      index: true,
    },
    venue: {
      type: String,
      default: 'RGUKT Ongole Campus / Online',
    },
    coordinator: {
      name: { type: String, default: 'TPO Placement Cell' },
      email: { type: String, default: 'tpo@rguktong.ac.in' },
      phone: { type: String, default: '+91 8592 245 678' },
    },
    registeredStudentsCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String, // userId
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
placementDriveSchema.index({ driveStatus: 1, 'registrationWindow.closeDate': 1 });
placementDriveSchema.index({ companyId: 1 });
placementDriveSchema.index({ 'eligibilityCriteria.allowedBranches': 1 });
placementDriveSchema.index({ batchYear: 1 });
placementDriveSchema.index({ driveCode: 1 }, { unique: true });
placementDriveSchema.index({
  title: 'text',
  companyName: 'text',
  driveCode: 'text',
});

// Auto-generate driveCode before validation
placementDriveSchema.pre('validate', async function (next) {
  if (!this.driveCode) {
    const year = new Date().getFullYear();
    const cleanCompany = (this.companyName || 'DRV')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase();
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    this.driveCode = `DRV-${year}-${cleanCompany}-${randomHex}`;
  }
  next();
});

const PlacementDrive = mongoose.model('PlacementDrive', placementDriveSchema);
export default PlacementDrive;
