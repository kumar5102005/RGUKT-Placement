import mongoose from 'mongoose';

const stageConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    description: {
      type: String,
      default: '',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: 'emerald', // emerald, blue, indigo, amber, rose, slate
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

stageConfigSchema.index({ order: 1 });

const StageConfig = mongoose.model('StageConfig', stageConfigSchema);
export default StageConfig;

