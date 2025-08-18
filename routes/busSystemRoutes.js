const express = require("express");
const {
  getBusSystemData,
  seedSystem,
  getNearbyStops, // 1. Import the new controller function
} = require("../controllers/busSystemController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(authMiddleware);

// GET /api/bus-system/data - Get all live data for the bus system
router.get("/data", getBusSystemData);

// *** 2. ADDED THIS NEW ROUTE TO HANDLE NEARBY STOP REQUESTS ***
// GET /api/bus-system/nearby-stops?lat=...&lon=...
router.get("/nearby-stops", getNearbyStops);

// POST /api/bus-system/seed - A utility endpoint to reset and seed the simulation data
router.post("/seed", seedSystem);

module.exports = router;
