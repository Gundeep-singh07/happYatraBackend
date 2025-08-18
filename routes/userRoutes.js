const express = require("express");
const multer = require("multer");
const {
  getProfile,
  updateProfile,
  updateLocation,
  updateLocationPreferences,
  getLocationHistory,
  getNearbyUsers,
  updateStats,
  uploadProfilePicture,
  deleteAccount,
} = require("../controllers/userController");

// ++ IMPORT THE NEW FRIEND CONTROLLER ++
const {
  getConnections,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} = require("../controllers/friendController");
// -- END OF IMPORT --

const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1, // Only 1 file
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith("image/")) {
      // Check specific image formats
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only JPEG, PNG, GIF and WebP images are allowed"));
      }
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Middleware to log user requests
const logUserRequest = (req, res, next) => {
  console.log(
    `[USER-${new Date().toISOString()}] ${req.method} ${
      req.originalUrl
    } - User: ${req.user?.userId || "Unknown"}`
  );
  next();
};

// Apply auth middleware and logging to all routes
router.use(authMiddleware);
router.use(logUserRequest);

// Profile Management Routes
// GET /api/user/profile - Get user profile
router.get("/profile", getProfile);

// PUT /api/user/profile - Update user profile
router.put("/profile", updateProfile);

// POST /api/user/upload-avatar - Upload profile picture
router.post(
  "/upload-avatar",
  (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              success: false,
              message: "File too large. Maximum size is 5MB",
            });
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
              success: false,
              message: "Too many files. Only 1 file allowed",
            });
          }
        }
        return res.status(400).json({
          success: false,
          message: err.message || "File upload error",
        });
      }
      next();
    });
  },
  uploadProfilePicture
);

// Location Management Routes
// PUT /api/user/location - Update user location
router.put("/location", updateLocation);

// PUT /api/user/location/preferences - Update location preferences
router.put("/location/preferences", updateLocationPreferences);

// GET /api/user/location/history - Get location history
router.get("/location/history", getLocationHistory);

// GET /api/user/nearby - Get nearby users
router.get("/nearby", getNearbyUsers);

// Stats and Activity Routes
// PUT /api/user/stats - Update user travel stats
router.put("/stats", updateStats);

// Account Management Routes
// DELETE /api/user/account - Delete user account
router.delete("/account", deleteAccount);

// ++ NEW: Friend Management Routes ++
router.get("/friends/connections", getConnections);
router.get("/friends/search", searchUsers);
router.post("/friends/request/:userId", sendFriendRequest);
router.post("/friends/accept/:userId", acceptFriendRequest);
router.delete("/friends/decline/:userId", declineFriendRequest);
router.delete("/friends/remove/:userId", removeFriend);
// -- END OF NEW ROUTES --

// Health check for user routes
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "User routes are working",
    timestamp: new Date().toISOString(),
    userId: req.user.userId,
  });
});

// Error handling middleware for user routes
router.use((error, req, res, next) => {
  console.error(`[USER-ERROR] ${req.method} ${req.originalUrl}:`, error);

  // Handle specific error types
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((err) => err.message);
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "Duplicate data error",
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
});

module.exports = router;
