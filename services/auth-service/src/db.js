// import mongoose from "mongoose";

// export async function connectDB(uri, logger) {
//   if (!uri) {
//     logger.warn("No MONGODB_URI provided. Skipping MongoDB connection.");
//     return false;
//   }
//   try {
//     mongoose.set("strictQuery", true);
//     await mongoose.connect(uri, {
//       serverSelectionTimeoutMS: 5000,
//     });
//     logger.info(`Connected to MongoDB successfully: ${uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")}`);
//     return true;
//   } catch (err) {
//     logger.error("Failed to connect to MongoDB", { error: err.message });
//     return false;
//   }
// }


import mongoose from "mongoose";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectDB(uri, logger) {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }

  mongoose.set("strictQuery", true);

  // Register connection lifecycle listeners once.
  mongoose.connection.on("connected", () => {
    logger.info("MongoDB connection established");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB connection lost");
  });

  mongoose.connection.on("error", (err) => {
    logger.error("MongoDB connection error", {
      error: err.message
    });
  });

  // Keep retrying until the initial connection succeeds.
  while (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });

      logger.info("Connected to MongoDB successfully");
      return true;
    } catch (err) {
      logger.error("MongoDB connection failed. Retrying in 5 seconds...", {
        error: err.message
      });

      await delay(5000);
    }
  }

  return true;
}


