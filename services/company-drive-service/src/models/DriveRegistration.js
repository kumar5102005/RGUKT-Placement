import mongoose from 'mongoose';

export const REGISTRATION_STATUSES = [
  'REGISTERED',
  'SHORTLISTED',
  'REJECTED',
  'ATTENDED',
  'OFFERED',
  'WITHDRAWN',
];

const roundStatusSchema = new mongoose.Schema(
  {
    roundNumber: { type: Number, required: true },
    roundName: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'CLEARED', 'ELIMINATED', 'ABSENT'],
      default: 'PENDING',
    },
    remarks: { type: String, default: '' },
    score: { type: Number, default: null },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: '' },
  },
  { _id: false }
);

const decisionHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    roundNumber: { type: Number, default: null },
    roundStatus: { type: String, default: '' },
    changedBy: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    remarks: { type: String, default: '' },
  },
  { _id: false }
);

const driveRegistrationSchema = new mongoose.Schema(
  {
    driveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PlacementDrive',
      required: [true, 'Drive reference is required'],
      index: true,
    },
    driveTitle: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    studentUserId: {
      type: String, // Auth service user ID
      required: [true, 'Student User ID is required'],
      index: true,
    },
    studentId: {
      type: String, // RGUKT ID e.g. O180123
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
    resumeFileName: { type: String, default: '' },
    resumeOriginalName: { type: String, default: '' },
    resumeMimeType: { type: String, default: '' },
    resumeSnapshotAt: { type: Date, default: null },
    status: {
      type: String,
      enum: REGISTRATION_STATUSES,
      default: 'REGISTERED',
      index: true,
    },
    roundProgress: {
      type: [roundStatusSchema],
      default: [],
    },
    decisionHistory: {
      type: [decisionHistorySchema],
      default: [],
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent duplicate student registrations for the same placement drive
driveRegistrationSchema.index({ driveId: 1, studentUserId: 1 }, { unique: true });
driveRegistrationSchema.index({ studentUserId: 1, registeredAt: -1 });
driveRegistrationSchema.index({ driveId: 1, status: 1 });

const DriveRegistration = mongoose.model('DriveRegistration', driveRegistrationSchema);
export default DriveRegistration;
