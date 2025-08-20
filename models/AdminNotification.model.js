const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    type: {
      type: String,
      required: [true, "Type is required"],
      enum: [
        "info",
        "warning",
        "success",
        "error",
        "traffic_jam",
        "rain",
        "road_block",
        "accident",
        "construction",
        "flood",
        "snow",
        "high_wind",
        "slippery_road",
      ],
      default: "info",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      required: true,
      default: "admin",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for better query performance
notificationSchema.index({ isActive: 1, createdAt: -1 });

// Static method to find active notifications for users
notificationSchema.statics.findActiveNotifications = function () {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

// Static method to find notifications by type
notificationSchema.statics.findByType = function (type) {
  return this.find({ type, isActive: true }).sort({ createdAt: -1 });
};

// Static method to find traffic-related notifications
notificationSchema.statics.findTrafficNotifications = function () {
  const trafficTypes = [
    "traffic_jam",
    "road_block",
    "accident",
    "construction",
  ];
  return this.find({
    type: { $in: trafficTypes },
    isActive: true,
  }).sort({ createdAt: -1 });
};

// Static method to find weather-related notifications
notificationSchema.statics.findWeatherNotifications = function () {
  const weatherTypes = ["rain", "flood", "snow", "high_wind", "slippery_road"];
  return this.find({
    type: { $in: weatherTypes },
    isActive: true,
  }).sort({ createdAt: -1 });
};

// Instance method to deactivate notification
notificationSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

const AdminNotification = mongoose.model(
  "AdminNotification",
  notificationSchema
);

module.exports = AdminNotification;
