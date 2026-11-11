import mongoose from 'mongoose';

const INDUSTRIES = [
  'IT Services',
  'Software Product',
  'Core Engineering',
  'Banking & Finance',
  'Consulting',
  'Healthcare',
  'E-Commerce',
  'Manufacturing',
  'Telecommunications',
  'Education & Ed-Tech',
  'Government & PSU',
  'Research & Development',
  'Other',
];

const VERIFICATION_STATUS = ['PENDING', 'VERIFIED', 'REJECTED'];

const recruiterEntrySchema = new mongoose.Schema(
  {
    userId: { type: String, default: null },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    designation: { type: String, default: 'Recruiter', trim: true },
    phone: { type: String, default: '', trim: true },
    role: { type: String, enum: ['PRIMARY', 'SECONDARY'], default: 'SECONDARY' },
    canManageJobs: { type: Boolean, default: false },
    canManageRecruitment: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INVITED', 'INACTIVE'], default: 'ACTIVE' },
    temporaryPassword: { type: String, select: false },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const companySchema = new mongoose.Schema(
  {
    // --- Identity ---
    name: {
      type: String,
      required: [true, 'Company name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Company name must be at least 2 characters'],
      maxlength: [150, 'Company name must not exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    industry: {
      type: String,
      required: [true, 'Industry is required'],
      enum: { values: INDUSTRIES, message: 'Invalid industry category' },
    },
    description: {
      type: String,
      maxlength: [2000, 'Description must not exceed 2000 characters'],
      default: '',
    },
    websiteUrl: {
      type: String,
      default: '',
    },
    logoUrl: {
      type: String,
      default: '',
    },

    // --- Location ---
    location: {
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      country: { type: String, default: 'India' },
    },

    // --- Contact ---
    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      default: '',
    },
    hrName: {
      type: String,
      default: '',
    },

    // --- External Links ---
    linkedinUrl: { type: String, default: '' },
    glassdoorUrl: { type: String, default: '' },

    // --- Verification ---
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUS,
      default: 'PENDING',
      index: true,
    },
    verifiedBy: {
      type: String, // admin userId
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationNotes: {
      type: String,
      maxlength: [500, 'Verification notes must not exceed 500 characters'],
      default: '',
    },

    // --- Recruiter Association ---
    registeredBy: {
      type: String, // recruiter userId
      required: true,
      index: true,
    },
    recruiters: {
      type: [recruiterEntrySchema],
      default: [],
    },

    // --- Metadata ---
    isActive: {
      type: Boolean,
      default: true,
    },
    placementDriveCount: {
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

// --- Indexes ---
companySchema.index({ name: 1 }, { unique: true });
companySchema.index({ slug: 1 }, { unique: true });
companySchema.index({ verificationStatus: 1 });
companySchema.index({ industry: 1 });
companySchema.index({ 'location.city': 1, 'location.state': 1 });
companySchema.index({ name: 'text', description: 'text' });

// --- Auto-generate slug before saving ---
companySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// --- Statics ---
companySchema.statics.INDUSTRIES = INDUSTRIES;
companySchema.statics.VERIFICATION_STATUS = VERIFICATION_STATUS;

const Company = mongoose.model('Company', companySchema);
export default Company;
