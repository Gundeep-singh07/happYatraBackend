const BusRoute = require("../models/BusRoute");
const axios = require("axios");

const OSRM_API_URL = "http://router.project-osrm.org/route/v1/driving/";
const BUNCHING_THRESHOLD_MINUTES = 2;

// --- Helper Functions ---
const getTrafficFactor = () => {
  const hour = new Date().getHours();
  if ((hour >= 7 && hour < 10) || (hour >= 16 && hour < 19)) return 1.5;
  return 1.1;
};

const getTravelDuration = async (startCoords, endCoords) => {
  try {
    const url = `${OSRM_API_URL}${startCoords.join(",")};${endCoords.join(
      ","
    )}?overview=false`;
    const response = await axios.get(url);
    return response.data.routes?.[0]?.duration * getTrafficFactor() || 300;
  } catch (error) {
    console.warn("OSRM API error, using default duration.");
    return 300;
  }
};

// --- Simulation and Analysis Logic ---
const updateBusPositions = async () => {
  // This function remains unchanged
  const routes = await BusRoute.find({});
  for (const route of routes) {
    if (!route.stops?.length || !route.buses?.length) continue;

    for (const bus of route.buses) {
      const nextStop = route.stops[bus.nextStopIndex % route.stops.length];
      const currentCoords = bus.currentLocation.coordinates;
      const nextStopCoords = nextStop.location.coordinates;

      const distanceToStop = Math.hypot(
        currentCoords[0] - nextStopCoords[0],
        currentCoords[1] - nextStopCoords[1]
      );

      if (distanceToStop < 0.001) {
        bus.nextStopIndex = (bus.nextStopIndex + 1) % route.stops.length;
        bus.passengerCount = Math.max(
          0,
          bus.passengerCount + Math.floor(Math.random() * 10 - 4)
        );
        if (bus.recommendation) {
          console.log(`Bus ${bus.busNumber} has acted on recommendation.`);
          bus.recommendation = null;
        }
      } else {
        const duration = await getTravelDuration(currentCoords, nextStopCoords);
        if (duration > 0) {
          const fraction = 15 / duration;
          bus.currentLocation.coordinates = [
            currentCoords[0] +
              (nextStopCoords[0] - currentCoords[0]) * fraction,
            currentCoords[1] +
              (nextStopCoords[1] - currentCoords[1]) * fraction,
          ];
        }
      }
      bus.lastUpdated = new Date();
    }
    await route.save();
  }
};

const analyzeHeadways = async () => {
  // This function remains unchanged
  const routes = await BusRoute.find({});
  for (const route of routes) {
    if (route.buses.length < 2) continue;
    route.buses.sort((a, b) => a.nextStopIndex - b.nextStopIndex);

    for (let i = 0; i < route.buses.length; i++) {
      const busB = route.buses[i];
      const busA =
        route.buses[(i + route.buses.length - 1) % route.buses.length];

      const stopDiff =
        (busB.nextStopIndex - busA.nextStopIndex + route.stops.length) %
        route.stops.length;

      const timeToNextA = await getTravelDuration(
        busA.currentLocation.coordinates,
        route.stops[busA.nextStopIndex].location.coordinates
      );
      const timeToNextB = await getTravelDuration(
        busB.currentLocation.coordinates,
        route.stops[busB.nextStopIndex].location.coordinates
      );
      const predictedHeadway = stopDiff * 300 + timeToNextB - timeToNextA;

      if (predictedHeadway / 60 < BUNCHING_THRESHOLD_MINUTES && stopDiff < 3) {
        busA.status = "At Risk";
        busB.status = "At Risk";
        if (!busB.recommendation) {
          const holdTime =
            Math.round(
              (BUNCHING_THRESHOLD_MINUTES * 60 - predictedHeadway) / 15
            ) * 15;
          if (holdTime > 30) {
            busB.recommendation = `Risk of bunching. HOLD at next stop for ${holdTime}s.`;
          }
        }
      } else {
        busA.status = "On Time";
        busB.status = "On Time";
      }
    }
    await route.save();
  }
};

// --- API Endpoint Handlers ---

const getBusSystemData = async (req, res) => {
  try {
    const routes = await BusRoute.find({});
    res.status(200).json({ success: true, data: routes });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// *** ADDED THIS ENTIRE FUNCTION TO HANDLE THE /nearby-stops ROUTE ***
const getNearbyStops = async (req, res) => {
  const { lat, lon } = req.query;
  const maxDistanceKm = 2; // Find stops within 2 km

  if (!lat || !lon) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Latitude and longitude are required.",
      });
  }

  try {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const maxDistanceMeters = maxDistanceKm * 1000;

    // IMPORTANT: For this query to be efficient, you MUST have a '2dsphere' index
    // on the 'stops.location' field in your BusRoute MongoDB model.
    const routesWithNearbyStops = await BusRoute.find({
      "stops.location": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude], // MongoDB requires [longitude, latitude]
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    });

    if (!routesWithNearbyStops.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const nearbyStops = [];
    routesWithNearbyStops.forEach((route) => {
      route.stops.forEach((stop) => {
        const stopLon = stop.location.coordinates[0];
        const stopLat = stop.location.coordinates[1];

        // Haversine formula for accurate distance calculation
        const R = 6371e3; // metres
        const φ1 = (latitude * Math.PI) / 180;
        const φ2 = (stopLat * Math.PI) / 180;
        const Δφ = ((stopLat - latitude) * Math.PI) / 180;
        const Δλ = ((stopLon - longitude) * Math.PI) / 180;
        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // in metres

        if (distance <= maxDistanceMeters) {
          if (
            !nearbyStops.some((s) => s._id.toString() === stop._id.toString())
          ) {
            nearbyStops.push({
              _id: stop._id,
              name: stop.name,
              routeName: route.routeName,
              walkingTime: Math.round(distance / 1.4 / 60), // Assumes 1.4 m/s walking speed
              distance: Math.round(distance),
            });
          }
        }
      });
    });

    nearbyStops.sort((a, b) => a.distance - b.distance);

    res.status(200).json({ success: true, data: nearbyStops });
  } catch (error) {
    console.error("Error fetching nearby stops:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const seedSystem = async (req, res) => {
  // This function remains unchanged
  try {
    await BusRoute.deleteMany({});
    const stopsData = [
      { name: "Central Station", coordinates: [77.446, 28.628] }, // Example: Ghaziabad
      { name: "City Hall", coordinates: [77.45, 28.63] },
      { name: "Midtown Library", coordinates: [77.435, 28.635] },
      { name: "Uptown Park", coordinates: [77.44, 28.64] },
      { name: "North Bridge", coordinates: [77.448, 28.645] },
    ];

    const route = new BusRoute({
      routeName: "Route 42 - City Circle",
      idealHeadwayMinutes: 8,
      stops: stopsData.map((s) => ({
        ...s,
        location: { type: "Point", coordinates: s.coordinates },
      })),
      buses: [
        {
          busNumber: "A-101",
          nextStopIndex: 0,
          currentLocation: {
            type: "Point",
            coordinates: stopsData[0].coordinates,
          },
          passengerCount: 15,
        },
        {
          busNumber: "A-102",
          nextStopIndex: 2,
          currentLocation: {
            type: "Point",
            coordinates: stopsData[2].coordinates,
          },
          passengerCount: 25,
        },
        {
          busNumber: "A-103",
          nextStopIndex: 4,
          currentLocation: {
            type: "Point",
            coordinates: stopsData[4].coordinates,
          },
          passengerCount: 10,
        },
      ],
    });
    await route.save();
    res
      .status(201)
      .json({ success: true, message: "System seeded successfully" });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Seeding failed",
        error: error.message,
      });
  }
};

// --- Service Starter ---
let simulationIntervals = [];
const startSimulation = () => {
  if (simulationIntervals.length > 0) return;
  console.log("🚌 Bus Simulation and Analysis Service starting...");
  simulationIntervals.push(setInterval(updateBusPositions, 15 * 1000));
  simulationIntervals.push(setInterval(analyzeHeadways, 30 * 1000));
};

// *** MODIFIED THE EXPORTS TO INCLUDE THE NEW FUNCTION ***
module.exports = {
  getBusSystemData,
  getNearbyStops, // <-- Added this export
  seedSystem,
  startSimulation,
};
