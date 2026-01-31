const mongoose = require('mongoose');

const timeSeriesSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  count: {
    type: Number,
    default: 0
  },
  data: [{
    name: {
      type: String,
      required: true
    },
    origin: {
      type: String,
      required: true
    },
    destination: {
      type: String,
      required: true
    },
    secret_key: {
      type: String,
      required: true
    },
    receivedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  collection: 'timeseries'
});

module.exports = mongoose.model('TimeSeries', timeSeriesSchema);