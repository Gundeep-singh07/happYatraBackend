const express = require("express");
const router = express.Router();
const AdminNotification = require("../models/AdminNotification.model");

// Temporary middleware for testing
const tempAuthMiddleware = (req, res, next) => {
  req.user = {
    id: "user-123",
    role: "user",
    fullName: "Test User",
    email: "user@example.com",
  };
  next();
};

// Apply temporary auth middleware to all routes
router.use(tempAuthMiddleware);

// Add request logging
router.use((req, res, next) => {
  next();
});

// GET /api/notifications - Get active notifications for users
const getActiveNotifications = async (req, res) => {
  try {
    console.log("=== Getting Active Notifications ===");

    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get active notifications
    const notifications = await AdminNotification.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await AdminNotification.countDocuments({ isActive: true });
    const totalPages = Math.ceil(total / parseInt(limit));
    const currentPage = parseInt(page);

    console.log(
      `Found ${notifications.length} active notifications out of ${total} total`
    );

    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          currentPage,
          totalPages,
          totalNotifications: total,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1,
          limit: parseInt(limit),
        },
      },
      message: "Notifications fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

// Routes
router.get("/", getActiveNotifications);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error("[User Routes] Error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error in user routes",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

module.exports = router;
