import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { createLogger } from "./logger.js";
import { connectDB } from "./db.js";
import applicationRoutes from "./routes/applicationRoutes.js";

dotenv.config();

const SERVICE_NAME = "application-service";
const PORT = process.env.PORT || 4004;
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
      target: "rgukt_application_db"
    },
    phase: "Phase 8 - Application and Recruitment Workflow"
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/v1/applications", applicationRoutes);
app.use("/", applicationRoutes);

// Centralized error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "INTERNAL_SERVER_ERROR",
      message: err.message || "An unexpected error occurred"
    }
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

