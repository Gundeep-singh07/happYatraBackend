// models/CarpoolRoute.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const carpoolRouteSchema = new mongoose.Schema(
  {
    driver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    origin: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    destination: {
      address: { type: String, required: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    departureTime: {
      type: Date,
      required: true,
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 1,
    },
    vehicleDetails: {
      type: String,
      trim: true,
    },
    fare: {
      type: Number,
      default: 0,
    },
    // Users who have clicked "Yatra" and are awaiting driver approval
    yatraRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Approved passengers
    passengers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["active", "full", "completed", "cancelled"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Index for performance
carpoolRouteSchema.index({ departureTime: -1 });
carpoolRouteSchema.index({ status: 1 });

module.exports = mongoose.model("CarpoolRoute", carpoolRouteSchema);
