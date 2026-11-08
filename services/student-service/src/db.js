import mongoose from "mongoose";

export async function connectDB(uri, logger) {
  if (!uri) {
    logger.warn("No MONGODB_URI provided. Skipping MongoDB connection.");
    return false;
  }
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`Connected to MongoDB successfully: ${uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")}`);
    return true;
  } catch (err) {
    logger.error("Failed to connect to MongoDB", { error: err.message });
    return false;
  }
}

