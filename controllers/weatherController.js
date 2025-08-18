const axios = require("axios");

const getWeatherByCoords = async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = process.env.WEATHER_API_KEY;

  if (!lat || !lon) {
    return res.status(400).json({
      success: false,
      message:
        "Latitude (lat) and Longitude (lon) query parameters are required.",
    });
  }

  if (!apiKey) {
    console.error("WEATHER_API_KEY is not set in the environment variables.");
    return res.status(500).json({
      success: false,
      message: "Server configuration error: Weather service is unavailable.",
    });
  }

  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}&aqi=no`;

  try {
    const response = await axios.get(url);
    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error(
      "Error fetching weather data:",
      error.response ? error.response.data : error.message
    );
    const status = error.response ? error.response.status : 500;
    const message = error.response
      ? error.response.data.error.message
      : "Failed to fetch weather data.";
    res.status(status).json({
      success: false,
      message,
    });
  }
};

module.exports = {
  getWeatherByCoords,
};
