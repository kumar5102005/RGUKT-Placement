require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const { initRabbitMQ, startConsumers } = require('./consumers');
const { Notification } = require('./models/Notification');

const app = express();
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

// simple endpoint to fetch in‑app notifications for a user
app.get('/api/v1/notifications/:userId', async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(notifs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/v1/notifications/internal', async (req, res) => {
  if (!SERVICE_API_KEY || req.get('x-service-key') !== SERVICE_API_KEY) {
    return res.status(403).json({
      success: false,
      error: { code: 'INVALID_SERVICE_KEY', message: 'Internal service authorization failed.' },
    });
  }

  const { eventId, userId, type, title, message, payload } = req.body;
  if (![eventId, userId, type, title, message].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_NOTIFICATION', message: 'Event ID, recipient, type, title, and message are required.' },
    });
  }

  try {
    const existing = await Notification.findOne({ eventId });
    if (existing) {
      return res.status(200).json({ success: true, data: { notification: existing }, duplicate: true });
    }

    const notification = await Notification.create({
      eventId,
      userId,
      type,
      title,
      message,
      payload,
    });
    return res.status(201).json({ success: true, data: { notification } });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Notification.findOne({ eventId });
      if (existing) {
        return res.status(200).json({ success: true, data: { notification: existing }, duplicate: true });
      }
    }
    console.error('Failed to store internal notification:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'NOTIFICATION_CREATE_FAILED', message: 'Failed to store notification.' },
    });
  }
});

const PORT = process.env.PORT || process.env.NOTIFICATION_SERVICE_PORT || 4005;

async function start() {
  // DB connection
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.NOTIFICATION_MONGODB_URI ||
    'mongodb://127.0.0.1:27017/notification_service';
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB');

  // RabbitMQ init & consumers
  await initRabbitMQ();
  await startConsumers();
  console.log('✅ RabbitMQ consumers started');

  app.listen(PORT, () => console.log(`🚀 Notification Service listening on port ${PORT}`));
}

start().catch(err => {
  console.error('❌ Fatal error during startup:', err);
  process.exit(1);
});
