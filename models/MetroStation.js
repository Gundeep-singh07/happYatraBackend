// models/MetroStation.js

const mongoose = require("mongoose");

const MetroStationSchema = new mongoose.Schema(
  {
    metro_station_name: {
      type: String,
      required: true,
      trim: true,
      index: true, // Add index for faster searching
    },
    location: {
      type: String,
      required: true,
    },
    station_id: {
      type: Number,
      required: true,
      unique: true,
    },
    metro_line: {
      type: String,
      required: true,
      trim: true,
      index: true, // Add index for filtering by line
    },
    distance_from_first: {
      type: Number,
      required: true,
    },
    opened_year: {
      type: String,
      required: true,
    },
    layout: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    processed_at: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false }, // Match python script field
    collection: "stations", // Explicitly use the collection name from your script
  }
);

// Create a compound text index for efficient searching on name and line
MetroStationSchema.index({ metro_station_name: "text", metro_line: "text" });

module.exports = mongoose.model("MetroStation", MetroStationSchema);
