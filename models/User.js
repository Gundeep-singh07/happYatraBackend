// models/User.js

const mongoose = require("mongoose");
const Schema = mongoose.Schema; // Import Schema for referencing

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    profilePicture: {
      url: String,
      publicId: String,
    },
    phone: String,
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    location: {
      latitude: {
        type: Number,
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180,
      },
      accuracy: {
        type: Number,
        min: 0,
      },
      address: String,
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
    locationHistory: [
      {
        latitude: {
          type: Number,
          required: true,
          min: -90,
          max: 90,
        },
        longitude: {
          type: Number,
          required: true,
          min: -180,
          max: 180,
        },
        accuracy: {
          type: Number,
          min: 0,
        },
        address: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    locationPreferences: {
      shareLocation: {
        type: Boolean,
        default: true,
      },
      trackingEnabled: {
        type: Boolean,
        default: false,
      },
      allowNotifications: {
        type: Boolean,
        default: true,
      },
      radius: {
        type: Number,
        default: 50, // km
        min: 1,
        max: 1000,
      },
    },
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      language: {
        type: String,
        default: "en",
      },
      notifications: {
        email: {
          type: Boolean,
          default: true,
        },
        push: {
          type: Boolean,
          default: true,
        },
        sms: {
          type: Boolean,
          default: false,
        },
      },
      transportation: {
        preferredModes: [
          {
            type: String,
            enum: [
              "bus",
              "metro",
              "taxi",
              "walking",
              "cycling",
              "carpooling",
              "train",
              "auto",
            ],
          },
        ],
        defaultRadius: {
          type: Number,
          default: 5, // km
        },
      },
    },
    stats: {
      totalTrips: {
        type: Number,
        default: 0,
      },
      totalDistance: {
        type: Number,
        default: 0, // in km
      },
      co2Saved: {
        type: Number,
        default: 0, // in kg
      },
      moneySaved: {
        type: Number,
        default: 0, // in currency
      },
      lastActive: {
        type: Date,
        default: Date.now,
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "moderator"],
      default: "user",
    },

    // ++ NEW: Fields for the friend system ++
    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: "User", // This links to other User documents
      },
    ],
    friendRequestsSent: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequestsReceived: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // -- END OF NEW FIELDS --
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ "location.latitude": 1, "location.longitude": 1 });
userSchema.index({ isActive: 1, role: 1 });
userSchema.index({ "stats.lastActive": -1 });

// Pre-save middleware to update lastActive when location changes
userSchema.pre("save", function (next) {
  if (this.isModified("location")) {
    this.stats.lastActive = new Date();
  }
  next();
});

// Virtual for full address
userSchema.virtual("fullAddress").get(function () {
  if (!this.address) return null;
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.zipCode,
    this.address.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
});

// Method to check if location is recent (within last hour)
userSchema.methods.hasRecentLocation = function () {
  if (!this.location || !this.location.lastUpdated) return false;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return this.location.lastUpdated > oneHourAgo;
};

// Method to get distance from a point
userSchema.methods.getDistanceFrom = function (latitude, longitude) {
  if (!this.location || !this.location.latitude || !this.location.longitude) {
    return null;
  }

  const R = 6371; // Radius of the Earth in km
  const dLat = (latitude - this.location.latitude) * (Math.PI / 180);
  const dLon = (longitude - this.location.longitude) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(this.location.latitude * (Math.PI / 180)) *
      Math.cos(latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Static method to find users within radius
userSchema.statics.findUsersWithinRadius = function (
  latitude,
  longitude,
  radiusInKm
) {
  const radiusInRadians = radiusInKm / 6371; // Convert km to radians

  return this.find({
    "location.latitude": {
      $gte: latitude - (radiusInRadians * 180) / Math.PI,
      $lte: latitude + (radiusInRadians * 180) / Math.PI,
    },
    "location.longitude": {
      $gte: longitude - (radiusInRadians * 180) / Math.PI,
      $lte: longitude + (radiusInRadians * 180) / Math.PI,
    },
    "locationPreferences.shareLocation": true,
    isActive: true,
  });
};

// Ensure virtual fields are serialized
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
