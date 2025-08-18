// controllers/carpoolController.js

const CarpoolRoute = require("../models/CarpoolRoute");
const User = require("../models/User");

// @desc    Create a new carpool route
// @route   POST /api/carpooling/routes
// @access  Private
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

    if (
      !origin?.address ||
      !destination?.address ||
      !departureTime ||
      !availableSeats
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Please fill all required fields." });
    }

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

    if (!populatedRoute) {
      return res
        .status(404)
        .json({ success: false, message: "Could not find the created route." });
    }

    // +++ THIS IS THE FIX +++
    // Changed status code from 21 to the correct 201 (Created)
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
// @route   GET /api/carpooling/routes
// @access  Private
const getAllRoutes = async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const routes = await CarpoolRoute.find({
      status: "active",
      departureTime: { $gt: oneHourAgo },
    })
      .populate("driver", "fullName profilePicture")
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

// @desc    Request to join a route ("Yatra")
// @route   POST /api/carpooling/routes/:id/yatra
// @access  Private
const requestYatra = async (req, res) => {
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

    const alreadyRequested = route.yatraRequests.some(
      (id) => id.toString() === req.user.userId
    );
    const alreadyPassenger = route.passengers.some(
      (id) => id.toString() === req.user.userId
    );

    if (alreadyRequested || alreadyPassenger) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "You have already sent a request or are a passenger on this ride.",
        });
    }

    if (route.status !== "active") {
      return res
        .status(400)
        .json({ success: false, message: "This ride is no longer available." });
    }

    route.yatraRequests.push(req.user.userId);
    await route.save();

    res.json({
      success: true,
      message: "Your request to join has been sent to the driver!",
    });
  } catch (error) {
    console.error("Request Yatra error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  createRoute,
  getAllRoutes,
  requestYatra,
};
