import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createLogger } from './logger.js';
import { connectDB } from './db.js';
import companyRoutes from './routes/companyRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import driveRoutes from './routes/driveRoutes.js';

dotenv.config();

const SERVICE_NAME = 'company-drive-service';
const PORT = process.env.PORT || 4003;
const MONGODB_URI = process.env.MONGODB_URI;
const logger = createLogger(SERVICE_NAME);

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      status: dbStatus,
      name: 'rgukt_drive_db',
    },
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
// Placement drive management routes.
app.use('/api/v1/drives', driveRoutes);
app.use('/placement-drives', driveRoutes);
app.use('/', driveRoutes);

// Job management routes.
app.use('/api/v1/jobs', jobRoutes);
app.use('/jobs', jobRoutes);
app.use('/api/v1/drives/jobs', jobRoutes);

// Company and recruiter routes.
app.use('/api/v1/drives', companyRoutes);
app.use('/', companyRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
    },
  });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  if (MONGODB_URI) {
    await connectDB(MONGODB_URI, logger);
  } else {
    logger.warn('MONGODB_URI not configured in environment');
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`${SERVICE_NAME} running on port ${PORT}`);
    logger.info('Routes mounted: /api/v1/drives, /health');
  });
}

start();
