// controllers/tripPlannerController.js
const axios = require("axios");

const planTrip = async (req, res) => {
  const { start, end } = req.body;
  const apiKey = process.env.ORS_API_KEY;

  if (!start || !end)
    return res
      .status(400)
      .json({
        success: false,
        message: "Start and end locations are required.",
      });
  if (!apiKey)
    return res
      .status(500)
      .json({
        success: false,
        message: "Trip planner service is not configured.",
      });

  try {
    const geocodeUrl = (text) =>
      `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(
        text
      )}`;
    const [startResponse, endResponse] = await Promise.all([
      axios.get(geocodeUrl(start)),
      axios.get(geocodeUrl(end)),
    ]);

    if (!startResponse.data.features?.[0] || !endResponse.data.features?.[0]) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Could not find one or both locations.",
        });
    }

    const startCoords = startResponse.data.features[0].geometry.coordinates;
    const endCoords = endResponse.data.features[0].geometry.coordinates;

    // *** DEBUGGING STEP: Change profile to 'driving-car' to confirm the rest of the logic works ***
    // The 'public-transport' profile seems to be unavailable for this specific long-distance query.
    const profile = "driving-car";
    const directionsUrl = `https://api.openrouteservice.org/v2/directions/${profile}`;

    const directionsPayload = { coordinates: [startCoords, endCoords] };
    const headers = {
      "Content-Type": "application/json",
      Authorization: apiKey,
    };

    console.log(
      `✅ DEBUG: Calling ORS with profile: ${profile} for coordinates`,
      directionsPayload.coordinates
    );

    const directionsResponse = await axios.post(
      directionsUrl,
      directionsPayload,
      { headers }
    );

    if (!directionsResponse.data.routes?.[0])
      return res
        .status(404)
        .json({ success: false, message: "No route found." });

    const route = directionsResponse.data.routes[0];
    const plan = route.segments.map((segment) => ({
      type: profile, // Now it will show 'driving-car'
      distance: segment.distance,
      duration: segment.duration,
      instructions: segment.steps.map((step) => step.instruction),
      routeName: `Route from ${start} to ${end}`,
    }));

    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    console.error(
      "Trip planning error:",
      error.response
        ? JSON.stringify(error.response.data, null, 2)
        : error.message
    );
    const errorMessage =
      error.response?.data?.error?.message ||
      "An error occurred while planning the trip.";
    return res.status(500).json({ success: false, message: errorMessage });
  }
};

module.exports = { planTrip };
