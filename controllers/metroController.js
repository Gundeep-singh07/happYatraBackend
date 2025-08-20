// controllers/metroController.js

const MetroStation = require("../models/MetroStation");

// Get all metro stations with filtering, searching, and pagination
const getStations = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, line } = req.query;

    const query = {};

    if (search) {
      // Use a case-insensitive regex for searching the station name
      query.metro_station_name = { $regex: search, $options: "i" };
    }

    if (line) {
      query.metro_line = line;
    }

    const stations = await MetroStation.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ metro_station_name: 1 }) // Sort alphabetically
      .exec();

    const count = await MetroStation.countDocuments(query);

    res.json({
      success: true,
      data: {
        stations,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        totalStations: count,
      },
      message: "Metro stations retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching metro stations:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching metro stations",
    });
  }
};

// Get a list of all unique metro lines
const getLines = async (req, res) => {
  try {
    const lines = await MetroStation.distinct("metro_line");
    // Sort the lines alphabetically
    lines.sort();

    res.json({
      success: true,
      data: lines,
      message: "Metro lines retrieved successfully",
    });
  } catch (error) {
    console.error("Error fetching metro lines:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching metro lines",
    });
  }
};

module.exports = {
  getStations,
  getLines,
};
