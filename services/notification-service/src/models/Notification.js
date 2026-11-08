const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // could be student, recruiter, admin
  type: { type: String, required: true }, // e.g., 'ApplicationSubmitted'
  title: { type: String, required: true },
  message: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed }, // additional data for UI navigation
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports.Notification = mongoose.model('Notification', NotificationSchema);

