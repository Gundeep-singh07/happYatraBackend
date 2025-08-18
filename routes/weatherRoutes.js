// backend/routes/weatherRoutes.js

const express = require("express");
const router = express.Router();
const { getWeatherByCoords } = require("../controllers/weatherController");

const authenticateToken = require("../middleware/auth");

router.get("/", authenticateToken, getWeatherByCoords);

module.exports = router;
