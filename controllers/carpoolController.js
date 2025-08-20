// controllers/carpoolController.js

const CarpoolRoute = require("../models/CarpoolRoute");

// @desc    Create a new carpool route
const createRoute = async (req, res) => {
  try {
    const {
      origin,
      destination,
      departureTime,
      availableSeats,
      vehicleDetails,
      fare,
    } = req.body;

    const newRoute = new CarpoolRoute({
      driver: req.user.userId,
      origin,
      destination,
      departureTime,
      availableSeats,
      vehicleDetails,
      fare,
    });
    const savedRoute = await newRoute.save();
    const populatedRoute = await CarpoolRoute.findById(savedRoute._id).populate(
      "driver",
      "fullName profilePicture"
    );
    res.status(201).json({
      success: true,
      message: "Carpool route posted successfully.",
      data: { route: populatedRoute },
    });
  } catch (error) {
    console.error("Create route error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Get all active carpool routes
const getAllRoutes = async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const routes = await CarpoolRoute.find({
      status: { $in: ["active", "full"] }, // Show active and full routes
      departureTime: { $gt: oneHourAgo },
    })
      // ++ POPULATE PASSENGERS AS WELL AS DRIVER ++
      .populate("driver", "fullName profilePicture")
      .populate("passengers", "fullName profilePicture")
      .sort({ departureTime: 1 });
    res.json({
      success: true,
      data: { routes },
    });
  } catch (error) {
    console.error("Get all routes error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// @desc    Join a carpool route
// @route   POST /api/carpooling/routes/:id/join
const joinRoute = async (req, res) => {
  try {
    const route = await CarpoolRoute.findById(req.params.id);
    if (!route) {
      return res
        .status(404)
        .json({ success: false, message: "Route not found." });
    }
    if (route.driver.toString() === req.user.userId) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot join your own ride." });
    }
    if (route.passengers.some((p) => p.toString() === req.user.userId)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You have already joined this ride.",
        });
    }
    if (route.passengers.length >= route.availableSeats) {
      return res
        .status(400)
        .json({ success: false, message: "Sorry, this ride is full." });
    }

    // Add user to passengers list
    route.passengers.push(req.user.userId);

    // If the last seat was just taken, update status to "full"
    if (route.passengers.length === route.availableSeats) {
      route.status = "full";
    }

    await route.save();

    // Populate and send back the updated route
    const updatedRoute = await CarpoolRoute.findById(route._id)
      .populate("driver", "fullName profilePicture")
      .populate("passengers", "fullName profilePicture");

    res.json({
      success: true,
      message: "Successfully joined the ride!",
      data: { route: updatedRoute },
    });
  } catch (error) {
    console.error("Join Route error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createRoute,
  getAllRoutes,
  joinRoute,
};
