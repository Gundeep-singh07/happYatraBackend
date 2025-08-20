// routes/metroRoutes.js

const express = require("express");
const { getStations, getLines } = require("../controllers/metroController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all metro routes
router.use(authMiddleware);

// GET /api/metro/stations - Get all stations with filters
router.get("/stations", getStations);

// GET /api/metro/lines - Get all unique metro lines
router.get("/lines", getLines);

module.exports = router;
