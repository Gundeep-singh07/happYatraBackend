const express = require("express");
const { planTrip } = require("../controllers/tripPlannerController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

// POST /api/trip-planner/plan
router.post("/plan", planTrip);

module.exports = router;
