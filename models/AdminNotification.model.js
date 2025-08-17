const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

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
        "traffic_jam",
        "road_closure",
        "construction",
        "accident",
        "weather_warning",
        "flooding",
        "landslide",
        "bridge_closure",
        "detour",
        "maintenance",
        "emergency",
        "event",
        "info",
        "warning",
        "success",
      ],
      default: "info",
    },
    status: {
      type: String,
      enum: ["draft", "active", "sent"],
      default: "draft",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    location: {
      latitude: {
        type: Number,
        min: [-90, "Latitude must be between -90 and 90"],
        max: [90, "Latitude must be between -90 and 90"],
      },
      longitude: {
        type: Number,
        min: [-180, "Longitude must be between -180 and 180"],
        max: [180, "Longitude must be between -180 and 180"],
      },
      address: {
        type: String,
        trim: true,
      },
    },
    recipients: {
      type: Number,
      default: 0,
      min: [0, "Recipients cannot be negative"],
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String, // Changed from ObjectId to String for temporary compatibility
      required: true,
      default: "system", // Default value for testing
    },
    sentAt: {
      type: Date,
      default: null,
    },
    readBy: [
      {
        user: {
          type: String, // Changed from ObjectId to String for temporary compatibility
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add pagination plugin
notificationSchema.plugin(mongoosePaginate);

// Indexes for better query performance
notificationSchema.index({ type: 1, status: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ "location.latitude": 1, "location.longitude": 1 });

// Virtual for checking if notification is expired
notificationSchema.virtual("isExpired").get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

// Pre-save middleware to update sentAt when status changes to 'sent'
notificationSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "sent" && !this.sentAt) {
    this.sentAt = new Date();
  }
  next();
});

// Static method to find active notifications
notificationSchema.statics.findActive = function () {
  return this.find({
    status: "active",
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  }).sort({ priority: -1, createdAt: -1 });
};

// Static method to find notifications by type
notificationSchema.statics.findByType = function (type) {
  return this.find({ type, isActive: true }).sort({ createdAt: -1 });
};

// Static method to find notifications within radius
notificationSchema.statics.findNearLocation = function (
  lat,
  lng,
  radiusInKm = 10
) {
  return this.find({
    "location.latitude": {
      $gte: lat - radiusInKm / 111, // Rough conversion: 1 degree ≈ 111 km
      $lte: lat + radiusInKm / 111,
    },
    "location.longitude": {
      $gte: lng - radiusInKm / (111 * Math.cos((lat * Math.PI) / 180)),
      $lte: lng + radiusInKm / (111 * Math.cos((lat * Math.PI) / 180)),
    },
    status: "active",
    isActive: true,
  });
};

// Instance method to mark as read by user
notificationSchema.methods.markAsRead = function (userId) {
  const existingRead = this.readBy.find(
    (read) => read.user && read.user.toString() === userId.toString()
  );

  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date(),
    });
    return this.save();
  }

  return Promise.resolve(this);
};

const AdminNotification = mongoose.model(
  "AdminNotification",
  notificationSchema
);

module.exports = AdminNotification;
