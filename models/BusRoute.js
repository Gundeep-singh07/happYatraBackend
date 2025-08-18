const mongoose = require("mongoose");

// Schema for a single stop, embedded within a route
const stopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
});

// Schema for a single bus, embedded within a route
const busSchema = new mongoose.Schema({
  busNumber: { type: String, required: true },
  currentLocation: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  status: {
    type: String,
    enum: ["On Time", "Delayed", "Early", "At Risk"],
    default: "On Time",
  },
  nextStopIndex: { type: Number, default: 0 },
  passengerCount: { type: Number, default: 0 },
  recommendation: { type: String, default: null }, // e.g., "HOLD at next stop for 45s"
  lastUpdated: { type: Date, default: Date.now },
});

// The main model for a Bus Route
const busRouteSchema = new mongoose.Schema({
  routeName: { type: String, required: true, unique: true },
  idealHeadwayMinutes: { type: Number, default: 10 },
  stops: [stopSchema],
  buses: [busSchema],
});

busRouteSchema.index({ "stops.location": "2dsphere" });
busRouteSchema.index({ "buses.currentLocation": "2dsphere" });

module.exports = mongoose.model("BusRoute", busRouteSchema);
