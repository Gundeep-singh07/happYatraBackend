// controllers/authController.js

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret";

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
};

// Register User
const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: "User created successfully",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Login User
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ++ NEW FUNCTION: Send OTP for phone verification ++
// @desc    Send OTP for phone verification
// @route   POST /api/auth/send-otp
// @access  Private (user must be logged in)
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Set OTP to expire in 10 minutes
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // In a real app, use Twilio/AiSensy here. For development, log it to the console.
    console.log(`\n\n--- OTP for ${phone} (${user.email}) ---`);
    console.log(`---      ${otp}      ---`);
    console.log(`--- Expires at: ${otpExpires.toLocaleTimeString()} ---\n\n`);

    res.json({
      success: true,
      message: "OTP has been sent to your server console for verification.",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while sending OTP" });
  }
};

// ++ NEW FUNCTION: Verify OTP and update user's phone number ++
// @desc    Verify OTP and update user's phone number
// @route   POST /api/auth/verify-otp
// @access  Private
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number and OTP are required" });
    }

    const user = await User.findOne({
      _id: req.user.userId,
      otp: otp,
      otpExpires: { $gt: Date.now() }, // Check if OTP is valid and not expired
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP or it has expired." });
    }

    // OTP is correct, update the user document
    user.phone = phone;
    user.phoneVerified = true;
    user.otp = undefined; // Clear the OTP fields after successful verification
    user.otpExpires = undefined;

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      success: true,
      message: "Phone number verified successfully.",
      user: userResponse, // Send back the updated user object
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while verifying OTP" });
  }
};

// -- OLD MODULE EXPORTS --
/*
module.exports = {
  register,
  login,
};
*/

// ++ NEW MODULE EXPORTS with OTP functions ++
module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
};
