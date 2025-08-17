const express = require("express");
const router = express.Router();
const {
  getAllNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
} = require("../controllers/AdminNotification.controller");

// Temporary middleware for testing - replace with your actual auth middleware later
const tempAuthMiddleware = (req, res, next) => {
  req.user = {
    id: "admin-user-id",
    role: "admin",
    fullName: "Admin User",
    email: "admin@example.com",
  };
  next();
};

// Apply temporary auth middleware to all routes
router.use(tempAuthMiddleware);

// Add request logging for debugging
router.use((req, res, next) => {
  console.log(
    `[Admin Routes] ${req.method} ${
      req.originalUrl
    } - ${new Date().toISOString()}`
  );
  next();
});

// Routes
router.get("/", getAllNotifications);
router.get("/:id", getNotificationById);
router.post("/", createNotification);
router.put("/:id", updateNotification);
router.delete("/:id", deleteNotification);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error("[Admin Routes] Error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error in admin routes",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
  });
});

module.exports = router;
