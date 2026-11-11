import mongoose from 'mongoose';

export const STANDARD_STAGES = [
  'Applied',
  'Under Review',
  'Shortlisted',
  'Interview Scheduled',
  'Selected',
  'Rejected',
  'Withdrawn',
];

export const PLACEMENT_STATUSES = [
  'PENDING',
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'REJECTED',
];

const interviewSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    roundName: { type: String, required: true, trim: true },
    roundType: {
      type: String,
      enum: ['APTITUDE', 'TECHNICAL', 'HR', 'CODING', 'MANAGERIAL', 'OTHER'],
      default: 'TECHNICAL',
    },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    mode: {
      type: String,
      enum: ['ONLINE', 'IN_PERSON', 'HYBRID'],
      default: 'ONLINE',
    },
    meetingLinkOrVenue: { type: String, default: '' },
    interviewerPanel: { type: [String], default: [] },
    instructions: { type: String, default: '' },
    status: {
      type: String,
      enum: ['SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'ABSENT'],
      default: 'SCHEDULED',
    },
    result: {
      type: String,
      enum: ['PENDING', 'PASSED', 'FAILED', 'ON_HOLD'],
      default: 'PENDING',
    },
    score: { type: Number, default: null },
    feedback: { type: String, default: '' },
    evaluatedBy: { type: String, default: null },
    evaluatedAt: { type: Date, default: null },
  },
  { _id: true }
);

const historyEntrySchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    changedBy: { type: String, required: true },
    changedByRole: { type: String, default: 'SYSTEM' },
    changedAt: { type: Date, default: Date.now },
    comments: { type: String, default: '' },
  },
  { _id: false }
);

const offerDetailsSchema = new mongoose.Schema(
  {
    offeredPackageLpa: { type: Number, default: 0 },
    joiningDate: { type: Date, default: null },
    offerLetterUrl: { type: String, default: '' },
    offerIssuedAt: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    remarks: { type: String, default: '' },
  },
  { _id: false }
);

const recruitmentRoundSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    mode: { type: String, enum: ['Online', 'In-Person', 'Hybrid'], default: 'Online' },
    scheduledDate: { type: Date, default: null },
    durationMinutes: { type: Number, default: null },
    venueOrLink: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PLANNED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'PLANNED',
    },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Job reference is required'],
      index: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Company reference is required'],
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    studentUserId: {
      type: String,
      required: [true, 'Student User ID is required'],
      index: true,
    },
    studentId: {
      type: String, // RGUKT University ID e.g. O180123
      required: [true, 'Student RGUKT ID is required'],
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    studentEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    branch: {
      type: String,
      required: true,
      uppercase: true,
    },
    btechCgpa: {
      type: Number,
      required: true,
    },
    activeBacklogs: {
      type: Number,
      required: true,
    },
    batchYear: {
      type: Number,
      required: true,
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    resumeFileName: { type: String, default: '', immutable: true },
    resumeDocumentId: { type: String, default: '', immutable: true },
    resumeStorageKey: { type: String, default: '', immutable: true },
    resumeOriginalName: { type: String, default: '', immutable: true },
    resumeMimeType: { type: String, default: '', immutable: true },
    resumeSnapshotAt: { type: Date, default: null, immutable: true },
    skills: {
      type: [String],
      default: [],
    },
    coverLetter: {
      type: String,
      default: '',
      maxlength: 3000,
    },
    stage: {
      type: String,
      required: true,
      default: 'Applied',
      index: true,
    },
    customStage: {
      type: String,
      default: null,
    },
    finalPlacementStatus: {
      type: String,
      enum: PLACEMENT_STATUSES,
      default: 'PENDING',
      index: true,
    },
    interviews: {
      type: [interviewSchema],
      default: [],
    },
    recruitmentRounds: {
      type: [recruitmentRoundSchema],
      default: [],
    },
    offerDetails: {
      type: offerDetailsSchema,
      default: () => ({}),
    },
    history: {
      type: [historyEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate applications by same student for the same job
applicationSchema.index({ jobId: 1, studentUserId: 1 }, { unique: true });
applicationSchema.index({ companyId: 1, stage: 1 });
applicationSchema.index({ studentUserId: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, stage: 1 });
applicationSchema.index({
  studentName: 'text',
  studentId: 'text',
  studentEmail: 'text',
  jobTitle: 'text',
  companyName: 'text',
});

const Application = mongoose.model('Application', applicationSchema);
export default Application;
