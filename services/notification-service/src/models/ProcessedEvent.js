const mongoose = require('mongoose');

const ProcessedEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
});

module.exports.ProcessedEvent = mongoose.model('ProcessedEvent', ProcessedEventSchema);

