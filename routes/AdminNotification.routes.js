const express = require("express");
const router = express.Router();
const {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  sendNotification,
  getNotificationStats,
} = require("../controllers/AdminNotification.controller");

// Temporary middleware for testing - replace with your actual auth middleware later
const tempAuthMiddleware = (req, res, next) => {
  // For testing purposes, we'll create a mock user
  // REMOVE THIS IN PRODUCTION - implement proper authentication
  req.user = {
    id: "temp-user-id",
    role: "admin",
    fullName: "Admin User",
    email: "admin@example.com",
  };
  next();
};

// Apply temporary auth middleware to all routes
// TODO: Replace with actual authentication middleware
router.use(tempAuthMiddleware);

// Routes

// GET /api/admin/notifications - Get all notifications with filtering
router.get("/", getAllNotifications);

// GET /api/admin/notifications/stats - Get notification statistics
router.get("/stats", getNotificationStats);

// GET /api/admin/notifications/:id - Get single notification
router.get("/:id", getNotificationById);

// POST /api/admin/notifications - Create new notification
router.post("/", createNotification);

// PUT /api/admin/notifications/:id - Update notification
router.put("/:id", updateNotification);

// DELETE /api/admin/notifications/:id - Delete notification
router.delete("/:id", deleteNotification);

// POST /api/admin/notifications/:id/send - Send notification
router.post("/:id/send", sendNotification);

module.exports = router;
