const express = require("express");
const router = express.Router();
const AdminNotification = require("../models/AdminNotification.model");

// Temporary middleware for testing - replace with your actual auth middleware later
const tempAuthMiddleware = (req, res, next) => {
  // For testing purposes, we'll create a mock user
  // REMOVE THIS IN PRODUCTION - implement proper authentication
  req.user = {
    id: "temp-user-id",
    role: "user",
    fullName: "Test User",
    email: "user@example.com",
  };
  next();
};

// Apply temporary auth middleware to all routes
// TODO: Replace with actual authentication middleware
router.use(tempAuthMiddleware);

// GET /api/notifications - Get active notifications for users
const getActiveNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      latitude,
      longitude,
      radius = 50, // Default 50km radius
    } = req.query;

    let query = {
      status: "active",
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };

    // Filter by type if provided
    if (type) {
      query.type = type;
    }

    // Filter by priority if provided
    if (priority) {
      query.priority = priority;
    }

    let notifications;

    // If location is provided, find notifications within radius
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const radiusInKm = parseFloat(radius);

      // Simple radius calculation (not using MongoDB geospatial queries for simplicity)
      query["location.latitude"] = {
        $gte: lat - radiusInKm / 111,
        $lte: lat + radiusInKm / 111,
      };
      query["location.longitude"] = {
        $gte: lng - radiusInKm / (111 * Math.cos((lat * Math.PI) / 180)),
        $lte: lng + radiusInKm / (111 * Math.cos((lat * Math.PI) / 180)),
      };
    }

    // Get notifications with pagination
    notifications = await AdminNotification.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate("createdBy", "fullName")
      .sort({ priority: -1, createdAt: -1 });

    // Get total count for pagination
    const total = await AdminNotification.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalNotifications: total,
          hasNext: page < Math.ceil(total / parseInt(limit)),
          hasPrev: page > 1,
        },
      },
      message: "Notifications fetched successfully",
    });
  } catch (error) {
    console.error("Get active notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// GET /api/notifications/types - Get available notification types
const getNotificationTypes = async (req, res) => {
  try {
    const types = [
      { value: "traffic_jam", label: "Traffic Jam", icon: "🚗" },
      { value: "road_closure", label: "Road Closure", icon: "🚧" },
      { value: "construction", label: "Construction", icon: "🏗️" },
      { value: "accident", label: "Accident", icon: "⚠️" },
      { value: "weather_warning", label: "Weather Warning", icon: "🌧️" },
      { value: "flooding", label: "Flooding", icon: "🌊" },
      { value: "landslide", label: "Landslide", icon: "🏔️" },
      { value: "bridge_closure", label: "Bridge Closure", icon: "🌉" },
      { value: "detour", label: "Detour", icon: "↩️" },
      { value: "maintenance", label: "Maintenance", icon: "🔧" },
      { value: "emergency", label: "Emergency", icon: "🚨" },
      { value: "event", label: "Event", icon: "📅" },
      { value: "info", label: "Information", icon: "ℹ️" },
      { value: "warning", label: "Warning", icon: "⚠️" },
      { value: "success", label: "Success", icon: "✅" },
    ];

    res.status(200).json({
      success: true,
      data: types,
      message: "Notification types fetched successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch notification types",
      error: error.message,
    });
  }
};

// POST /api/notifications/:id/read - Mark notification as read
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await AdminNotification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Check if already read
    const existingRead = notification.readBy.find(
      (read) => read.user && read.user.toString() === userId.toString()
    );

    if (!existingRead) {
      notification.readBy.push({
        user: userId,
        readAt: new Date(),
      });
      await notification.save();
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

// GET /api/notifications/unread-count - Get unread notification count for user
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await AdminNotification.countDocuments({
      status: "active",
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      "readBy.user": { $ne: userId },
    });

    res.status(200).json({
      success: true,
      data: { unreadCount },
      message: "Unread count fetched successfully",
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count",
      error: error.message,
    });
  }
};

// Routes
router.get("/", getActiveNotifications);
router.get("/types", getNotificationTypes);
router.get("/unread-count", getUnreadCount);
router.post("/:id/read", markNotificationAsRead);

module.exports = router;
