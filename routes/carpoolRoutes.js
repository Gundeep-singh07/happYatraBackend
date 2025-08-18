// routes/carpoolRoutes.js

const express = require("express");
const {
  createRoute,
  getAllRoutes,
  requestYatra,
} = require("../controllers/carpoolController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all carpooling routes
router.use(authMiddleware);

// POST /api/carpooling/routes - Create a new route
router.post("/routes", createRoute);

// GET /api/carpooling/routes - Get all active routes
router.get("/routes", getAllRoutes);

// POST /api/carpooling/routes/:id/yatra - Request to join a route
router.post("/routes/:id/yatra", requestYatra);

module.exports = router;
