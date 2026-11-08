require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const { initRabbitMQ, startConsumers } = require('./consumers');
const { Notification } = require('./models/Notification');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', phase: 'Phase 9 – Notification Service' });
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

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 4005;

async function start() {
  // DB connection
  const mongoUri = process.env.NOTIFICATION_MONGODB_URI || 'mongodb://localhost:27017/notification_service';
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
