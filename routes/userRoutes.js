const express = require("express");
const multer = require("multer");
const {
  getProfile,
  updateProfile,
  uploadProfilePicture,
} = require("../controllers/userController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images allowed"));
    }
  },
});

// GET /api/user/profile
router.get("/profile", authMiddleware, getProfile);

// PUT /api/user/profile
router.put("/profile", authMiddleware, updateProfile);

// POST /api/user/upload-avatar
router.post(
  "/upload-avatar",
  authMiddleware,
  upload.single("avatar"),
  uploadProfilePicture
);

module.exports = router;
