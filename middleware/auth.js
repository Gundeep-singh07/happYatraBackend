// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Adjust path as needed

const JWT_SECRET = process.env.JWT_SECRET || "your-jwt-secret"; // Ensure this matches authController

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token =
      authHeader &&
      authHeader.startsWith("Bearer ") &&
      authHeader.split(" ")[1];

    if (!token) {
      // No token provided, immediately deny access
      console.log("[Auth Middleware] Failed: No token provided.");
      return res.status(401).json({
        success: false,
        message: "Access Denied. No token provided.",
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Token is valid, now fetch the user from the database
    // We select '-password' to exclude the password hash from the user object
    const user = await User.findById(decoded.userId).select("-password").lean();

    if (!user) {
      // Token is valid, but the user it points to no longer exists
      console.log(
        `[Auth Middleware] Failed: User not found for token with ID: ${decoded.userId}`
      );
      return res.status(401).json({
        success: false,
        message: "Authorization failed. User not found.",
      });
    }

    // IMPORTANT: The user object from the DB has `_id`, not `userId`.
    // The rest of your app (controllers, loggers) expects `req.user.userId`.
    // Let's create a consistent object.
    req.user = {
      userId: user._id.toString(), // Convert ObjectId to string
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      // You can add other lightweight properties if needed
    };

    // For controllers that need the full Mongoose document, we can attach it separately if needed,
    // but for now, this lightweight object is safer and more performant.
    // req.fullUserDoc = user;

    // console.log(`[Auth Middleware] Success: User ${req.user.fullName} authenticated.`);
    next(); // Success! Proceed to the next middleware/controller.
  } catch (error) {
    console.error("[Auth Middleware] Error:", error.message);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired.",
      });
    }

    // Generic server error for any other issues
    return res.status(500).json({
      success: false,
      message: "An internal authentication error occurred.",
    });
  }
};

module.exports = authMiddleware;
