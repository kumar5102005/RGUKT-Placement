const amqp = require('amqplib');
const { Notification } = require('../models/Notification');
const { ProcessedEvent } = require('../models/ProcessedEvent');
const nodemailer = require('nodemailer');

let channel;
const EXCHANGE = 'placement_hub_events';
const DLX = `${EXCHANGE}.dlx`;

async function initRabbitMQ() {
  const rabbitUrl = process.env.RABBITMQ_URL || process.env.LOCAL_RABBITMQ_URI || 'amqp://localhost';
  const connection = await amqp.connect(rabbitUrl);
  channel = await connection.createChannel();

  // Main exchange (topic)
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  // Dead-letter exchange
  await channel.assertExchange(DLX, 'fanout', { durable: true });

  console.log('✅ RabbitMQ connection & exchanges ready');
}

async function startConsumers() {
  // Create a queue for notification service with DLX
  const q = await channel.assertQueue('notification_service_queue', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX,
      // Max attempts for retry; using TTL and DLX for requeue logic later
    },
  });

  await channel.bindQueue(q.queue, EXCHANGE, '*'); // receive all events

  channel.consume(q.queue, async (msg) => {
    if (!msg) return;
    try {
      const content = JSON.parse(msg.content.toString());
      const { eventId, type, data } = content;

      // Duplicate protection
      const exists = await ProcessedEvent.findOne({ eventId }).exec();
      if (exists) {
        console.log(`⚠️ Duplicate event ${eventId} ignored`);
        channel.ack(msg);
        return;
      }

      // Process based on type
      await handleEvent(type, data);

      // Record processed
      await ProcessedEvent.create({ eventId, type });
      channel.ack(msg);
    } catch (err) {
      console.error('❌ Error processing message', err);
      // Nack with requeue = false -> goes to DLX
      channel.nack(msg, false, false);
    }
  }, { noAck: false });

  // Consumer for dead-letter queue (optional logging)
  const dlq = await channel.assertQueue('notification_service_dlq', { durable: true });
  await channel.bindQueue(dlq.queue, DLX, '#');
  channel.consume(dlq.queue, (msg) => {
    console.error('🛑 Dead-lettered message:', msg.content.toString());
    channel.ack(msg);
  });
}

async function handleEvent(type, data) {
  switch (type) {
    case 'StudentRegistered':
      await createInAppNotification(data.userId, type, 'Welcome!', `Your account has been created.`);
      await sendEmail(data.email, 'Welcome to Placement Hub', `Hello ${data.name}, your account is ready.`);
      break;
    case 'ApplicationSubmitted':
      // Notify student
      await createInAppNotification(data.studentUserId, type, 'Application Received', `Your application for ${data.jobTitle} has been received.`);
      await sendEmail(data.studentEmail, 'Application Submitted', `Your application for ${data.jobTitle} was submitted.`);
      // Notify recruiter (assume recruiterId in data)
      if (data.recruiterUserId) {
        await createInAppNotification(data.recruiterUserId, type, 'New Application', `${data.studentName} applied for ${data.jobTitle}.`);
        await sendEmail(data.recruiterEmail, 'New Application Received', `${data.studentName} applied for ${data.jobTitle}.`);
      }
      break;
    // Add other event handlers similarly
    default:
      console.log(`ℹ️ No specific handler for event type ${type}, stored as generic notification.`);
      await createInAppNotification(data.userId || data.recipientId, type, type, JSON.stringify(data));
  }
}

async function createInAppNotification(userId, type, title, message, payload = {}) {
  await Notification.create({ userId, type, title, message, payload });
}

async function sendEmail(to, subject, text) {
  if (!process.env.EMAIL_ENABLED?.toLowerCase().startsWith('true')) return; // skip if disabled
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, text });
}

module.exports = { initRabbitMQ, startConsumers };
