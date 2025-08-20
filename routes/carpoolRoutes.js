// routes/carpoolRoutes.js

const express = require("express");
const {
  createRoute,
  getAllRoutes,
  joinRoute, // <-- UPDATE THIS
} = require("../controllers/carpoolController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();
router.use(authMiddleware);

router.post("/routes", createRoute);
router.get("/routes", getAllRoutes);

// UPDATE ROUTE to /join and use joinRoute controller
router.post("/routes/:id/join", joinRoute);

module.exports = router;
