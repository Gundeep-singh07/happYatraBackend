// routes/authRoutes.js

const express = require("express");
// -- OLD CONTROLLER IMPORTS --
// const { register, login } = require("../controllers/authController");

// ++ NEW CONTROLLER IMPORTS ++
const {
  register,
  login,
  sendOtp,
  verifyOtp,
} = require("../controllers/authController");
// ++ NEW MIDDLEWARE IMPORT ++
// Ensure you have this middleware file at the specified path
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// --- PUBLIC ROUTES (No auth token required) ---

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

// --- PRIVATE ROUTES (Auth token is required) ---

// ++ NEW ROUTE: Send OTP to the user's console ++
// This route is protected by authMiddleware because we need to know which user is requesting the OTP.
router.post("/send-otp", authMiddleware, sendOtp);

// ++ NEW ROUTE: Verify the OTP provided by the user ++
// This is also protected to associate the verification with the logged-in user.
router.post("/verify-otp", authMiddleware, verifyOtp);

module.exports = router;
