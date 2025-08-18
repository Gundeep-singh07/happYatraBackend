const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const adminNotificationRoutes = require("./routes/AdminNotification.routes");
const userNotificationRoutes = require("./routes/UserNotification.routes");
const weatherRoutes = require("./routes/weatherRoutes");

const busSystemRoutes = require("./routes/busSystemRoutes");
const { startSimulation } = require("./controllers/busSystemController");
const tripPlannerRoutes = require("./routes/tripPlannerRoutes");
const carpoolRoutes = require("./routes/carpoolRoutes");

const app = express();
const PORT = process.env.PORT || 80;

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1:8080",
    "http://localhost:5173", // Vite dev server
    "http://localhost:5174", // Vite dev server alternate port
    process.env.FRONTEND_URL || "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cache-Control",
    "Pragma",
  ],
  exposedHeaders: ["Content-Range", "X-Total-Count"],
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options("*", cors(corsOptions));

// Body parsing middleware (must come after CORS)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Security headers
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-Frame-Options", "DENY");
  res.header("X-XSS-Protection", "1; mode=block");
  next();
});

// Enhanced request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);

  // Log request body for debugging (exclude sensitive routes)
  if (
    req.body &&
    Object.keys(req.body).length > 0 &&
    !url.includes("/auth/login")
  ) {
    console.log(
      `[${timestamp}] Request Body:`,
      JSON.stringify(req.body, null, 2)
    );
  }

  // Log query params
  if (req.query && Object.keys(req.query).length > 0) {
    console.log(`[${timestamp}] Query Params:`, req.query);
  }

  next();
});

// Database connection with better error handling
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    console.log("🔄 Attempting to connect to MongoDB...");
    console.log(
      "📍 MongoDB URI:",
      mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")
    ); // Hide credentials in logs

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      heartbeatFrequencyMS: 2000, // 2 seconds
      maxPoolSize: 10,
    });

    console.log("✅ Connected to MongoDB successfully");
    console.log("📊 Database:", conn.connection.db.databaseName);
    console.log("🌐 Host:", conn.connection.host);
    console.log("📡 Port:", conn.connection.port);

    // Listen for connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected");
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error("🔍 Full error:", error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// Health check with database status
app.get("/api/health", async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState;
    const dbStatusMap = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    const healthData = {
      status: "OK",
      service: "happYatra Backend",
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatusMap[dbStatus],
        name: mongoose.connection.db?.databaseName || "unknown",
        host: mongoose.connection.host || "unknown",
        port: mongoose.connection.port || "unknown",
      },
      server: {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
    };

    // If database is not connected, return 503
    if (dbStatus !== 1) {
      return res.status(503).json({
        ...healthData,
        status: "Service Unavailable",
        message: "Database is not connected",
      });
    }

    res.status(200).json(healthData);
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "Error",
      service: "happYatra Backend",
      message: "Health check failed",
      error: error.message,
    });
  }
});

// API Routes
console.log("🔗 Setting up API routes...");

// Mount routes with logging
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/carpooling", carpoolRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/notifications", userNotificationRoutes);

// ✅ FIX 1: ADD THIS LINE TO ACTUALLY USE THE WEATHER ROUTE
app.use("/api/weather", weatherRoutes);

app.use("/api/bus-system", busSystemRoutes);
app.use("/api/trip-planner", tripPlannerRoutes); // Add this lin

console.log("✅ API routes configured:");
console.log("   📡 /api/auth");
console.log("   👤 /api/user");
console.log("   🔧 /api/admin/notifications");
console.log("   📢 /api/notifications");
console.log("   ☁️ /api/weather");
console.log("   🚌 /api/bus-system"); // Add this to your logs
console.log("   🗺️ /api/trip-planner"); // Optional: add to logs

// Test endpoints for debugging
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Server is working correctly",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/debug/env", (req, res) => {
  // Only show environment info in development
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({
      success: false,
      message: "Environment info not available in production",
    });
  }

  res.json({
    success: true,
    data: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      MONGODB_URI: process.env.MONGODB_URI ? "Set" : "Not Set",
      FRONTEND_URL: process.env.FRONTEND_URL,
    },
  });
});

// ✅ FIX 2: MOVE THE ERROR AND 404 HANDLERS TO THE END

// Global error handling middleware (MUST BE AFTER ROUTES)
app.use((err, req, res, next) => {
  console.error("🚨 Global Error Handler:");
  console.error("📍 URL:", req.originalUrl);
  console.error("🎯 Method:", req.method);
  console.error("💥 Error:", err);
  console.error("📚 Stack:", err.stack);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(isDevelopment && {
      error: err.message,
      stack: err.stack,
      details: err,
    }),
  });
});

// 404 handler for API routes (MUST BE AFTER ROUTES AND BEFORE GENERAL 404)
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: [
      "GET /api/health",
      "GET /api/test",
      "POST /api/auth/login",
      "GET /api/notifications",
      "GET /api/admin/notifications",
      "GET /api/weather", // Added for clarity
    ],
  });
});

// General 404 handler (MUST BE LAST)
app.use((req, res) => {
  console.warn(`❓ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
    suggestion: "Make sure you're accessing the correct API endpoint",
  });
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("\n🔄 Received shutdown signal, closing server gracefully...");

  mongoose.connection.close(() => {
    console.log("📡 MongoDB connection closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Start server
const server = app.listen(PORT, () => {
  console.log("\n🚀 ===== HappYatra Backend Server Started =====");
  console.log(`🌐 Server running on port: ${PORT}`);
  console.log(`🔗 Server URL: http://localhost:${PORT}`);
  console.log(`💊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🧪 Test Endpoint: http://localhost:${PORT}/api/test`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("🎯 Available Endpoints:");
  console.log("   📡 Auth: /api/auth/*");
  console.log("   👤 User: /api/user/*");
  console.log("   🔧 Admin Notifications: /api/admin/notifications/*");
  console.log("   📢 User Notifications: /api/notifications/*");
  console.log("   ☁️ Weather: /api/weather/*"); // Added for clarity
  console.log("===============================================\n");
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error(
      "💡 Try using a different port or close the other application"
    );
  } else {
    console.error("❌ Server error:", error);
  }
  process.exit(1);
});

// Export for testing
module.exports = app;
