const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const bcrypt = require("bcrypt");

// Get User Profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
      message: "Profile retrieved successfully",
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update User Profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address, preferences } = req.body;
    const updateData = {};

    if (fullName) {
      if (fullName.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Full name must be at least 2 characters long",
        });
      }
      updateData.fullName = fullName.trim();
    }

    if (phone) {
      const phoneRegex = /^[+]?[\d\s\-\(\)]{10,15}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format",
        });
      }
      updateData.phone = phone;
    }

    if (address) updateData.address = address;
    if (preferences)
      updateData.preferences = { ...updateData.preferences, ...preferences };

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update User Location
const updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, accuracy, address } = req.body;

    // Validate required fields
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Validate ranges
    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid latitude or longitude values",
      });
    }

    if (accuracy && (accuracy < 0 || accuracy > 100000)) {
      return res.status(400).json({
        success: false,
        message: "Accuracy must be between 0 and 100000 meters",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const locationData = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null,
      address: address || null,
      lastUpdated: new Date(),
    };

    // Check for significant location change
    let isSignificantChange = true;
    if (user.location?.latitude && user.location?.longitude) {
      const distance = user.getDistanceFrom(
        locationData.latitude,
        locationData.longitude
      );
      isSignificantChange = !distance || distance > 0.01; // 10 meters
    }

    // Update current location
    user.location = locationData;

    // Add to location history if significant change
    if (isSignificantChange) {
      user.locationHistory.unshift({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        accuracy: locationData.accuracy,
        address: locationData.address,
        timestamp: new Date(),
      });

      // Keep only last 50 entries
      if (user.locationHistory.length > 50) {
        user.locationHistory = user.locationHistory.slice(0, 50);
      }
    }

    user.stats.lastActive = new Date();
    await user.save();

    res.json({
      success: true,
      message: "Location updated successfully",
      data: {
        location: user.location,
        isSignificantChange,
      },
    });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating location",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Location Preferences
const updateLocationPreferences = async (req, res) => {
  try {
    const { shareLocation, trackingEnabled, allowNotifications, radius } =
      req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.locationPreferences) {
      user.locationPreferences = {};
    }

    if (shareLocation !== undefined) {
      user.locationPreferences.shareLocation = Boolean(shareLocation);
    }
    if (trackingEnabled !== undefined) {
      user.locationPreferences.trackingEnabled = Boolean(trackingEnabled);
    }
    if (allowNotifications !== undefined) {
      user.locationPreferences.allowNotifications = Boolean(allowNotifications);
    }
    if (radius !== undefined) {
      if (radius < 1 || radius > 1000) {
        return res.status(400).json({
          success: false,
          message: "Radius must be between 1 and 1000 km",
        });
      }
      user.locationPreferences.radius = parseFloat(radius);
    }

    await user.save();

    res.json({
      success: true,
      message: "Location preferences updated successfully",
      preferences: user.locationPreferences,
    });
  } catch (error) {
    console.error("Update location preferences error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating location preferences",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Location History
const getLocationHistory = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    const user = await User.findById(req.user.userId).select("locationHistory");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const locationHistory = user.locationHistory.slice(startIndex, endIndex);

    res.json({
      success: true,
      locationHistory,
      pagination: {
        currentPage: pageNum,
        totalEntries: user.locationHistory.length,
        totalPages: Math.ceil(user.locationHistory.length / limitNum),
        hasNext: endIndex < user.locationHistory.length,
        hasPrev: startIndex > 0,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Get location history error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching location history",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Nearby Users
const getNearbyUsers = async (req, res) => {
  try {
    const { radius = 10, limit = 20 } = req.query;

    const user = await User.findById(req.user.userId);
    if (!user?.location?.latitude || !user?.location?.longitude) {
      return res.status(400).json({
        success: false,
        message:
          "User location not available. Please update your location first.",
      });
    }

    const radiusNum = Math.min(100, Math.max(1, parseFloat(radius)));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    const nearbyUsers = await User.findUsersWithinRadius(
      user.location.latitude,
      user.location.longitude,
      radiusNum
    )
      .select("fullName profilePicture.url location stats.totalTrips createdAt")
      .limit(limitNum);

    const usersWithDistance = nearbyUsers
      .filter((nearbyUser) => nearbyUser._id.toString() !== user._id.toString())
      .map((nearbyUser) => {
        const distance = user.getDistanceFrom(
          nearbyUser.location.latitude,
          nearbyUser.location.longitude
        );

        return {
          _id: nearbyUser._id,
          fullName: nearbyUser.fullName,
          profilePicture: nearbyUser.profilePicture,
          location: {
            address: nearbyUser.location.address,
            latitude: parseFloat(nearbyUser.location.latitude.toFixed(4)),
            longitude: parseFloat(nearbyUser.location.longitude.toFixed(4)),
          },
          stats: {
            totalTrips: nearbyUser.stats.totalTrips,
          },
          distance: parseFloat(distance.toFixed(2)),
          memberSince: nearbyUser.createdAt,
        };
      })
      .sort((a, b) => a.distance - b.distance);

    res.json({
      success: true,
      nearbyUsers: usersWithDistance,
      count: usersWithDistance.length,
      searchRadius: radiusNum,
      userLocation: {
        address: user.location.address,
      },
    });
  } catch (error) {
    console.error("Get nearby users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while finding nearby users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update User Stats
const updateStats = async (req, res) => {
  try {
    const { tripDistance, transportMode, co2Saved, moneySaved } = req.body;

    if (!tripDistance || tripDistance <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid trip distance is required",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.stats) {
      user.stats = {
        totalTrips: 0,
        totalDistance: 0,
        co2Saved: 0,
        moneySaved: 0,
        lastActive: new Date(),
      };
    }

    user.stats.totalTrips += 1;
    user.stats.totalDistance += parseFloat(tripDistance);
    if (co2Saved && co2Saved > 0) {
      user.stats.co2Saved += parseFloat(co2Saved);
    }
    if (moneySaved && moneySaved > 0) {
      user.stats.moneySaved += parseFloat(moneySaved);
    }
    user.stats.lastActive = new Date();

    if (!user.preferences) {
      user.preferences = { transportation: { preferredModes: [] } };
    }
    if (!user.preferences.transportation) {
      user.preferences.transportation = { preferredModes: [] };
    }

    if (
      transportMode &&
      !user.preferences.transportation.preferredModes.includes(transportMode)
    ) {
      user.preferences.transportation.preferredModes.push(transportMode);
    }

    await user.save();

    res.json({
      success: true,
      message: "Trip stats updated successfully",
      stats: user.stats,
    });
  } catch (error) {
    console.error("Update stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating stats",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Upload Profile Picture
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old image if exists
    if (user.profilePicture?.publicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicture.publicId);
      } catch (deleteError) {
        console.warn("Failed to delete old profile picture:", deleteError);
      }
    }

    // Upload new image to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "happyatra/profiles",
            transformation: [
              { width: 300, height: 300, crop: "fill", quality: "auto" },
              { fetch_format: "auto" },
            ],
            public_id: `user_${user._id}_${Date.now()}`,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    const result = await uploadPromise;

    user.profilePicture = {
      url: result.secure_url,
      publicId: result.public_id,
    };

    await user.save();

    res.json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error("Upload profile picture error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while uploading profile picture",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete User Account
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required to delete account",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Delete profile picture from Cloudinary if exists
    if (user.profilePicture?.publicId) {
      try {
        await cloudinary.uploader.destroy(user.profilePicture.publicId);
      } catch (deleteError) {
        console.warn("Failed to delete profile picture:", deleteError);
      }
    }

    // Delete user account
    await User.findByIdAndDelete(req.user.userId);

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting account",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateLocation,
  updateLocationPreferences,
  getLocationHistory,
  getNearbyUsers,
  updateStats,
  uploadProfilePicture,
  deleteAccount,
};
