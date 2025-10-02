const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    photoUrl: { type: String, default: '' },
   // visibility: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);

