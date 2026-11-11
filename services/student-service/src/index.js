import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { createLogger } from "./logger.js";
import { connectDB } from "./db.js";
import studentRoutes from "./routes/studentRoutes.js";

const SERVICE_NAME = "student-service";
const PORT = process.env.PORT || 4002;
const MONGODB_URI = process.env.MONGODB_URI;
const logger = createLogger(SERVICE_NAME);

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("combined"));

// Health check endpoint
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.status(200).json({
    status: "ok",
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStatus,
      target: "rgukt_student_db",
    },
  });
});

// Mount Student routes (at root and /api/v1/students)
app.use("/api/v1/students", studentRoutes);
app.use("/", studentRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    err.status = 413;
    err.code = "FILE_TOO_LARGE";
    err.message = "Resume exceeds the maximum allowed size of 10 MB.";
  }

  if (err?.code === "LIMIT_UNEXPECTED_FILE") {
    err.status = 400;
    err.code = "INVALID_FILE_FIELD";
    err.message = "Resume upload must use a single 'resume' field.";
  }

  logger.error("Unhandled error in Student Service", { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "STUDENT_SERVICE_ERROR",
      message: err.message || "An unexpected error occurred in Student Service",
    },
  });
});

async function start() {
  if (MONGODB_URI) {
    await connectDB(MONGODB_URI, logger);
  } else {
    logger.warn("MONGODB_URI not configured in environment");
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`${SERVICE_NAME} running on port ${PORT}`);
  });
}

start();
