import fetch from "node-fetch";
/**
 * Calculate distance in miles using Google Distance Matrix
 */
export async function calculateDistanceMiles({
  fromPlaceId,
  toPlaceId,
}) {
  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=place_id:${fromPlaceId}&destinations=place_id:${toPlaceId}&units=imperial&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK") {
    throw new Error("Google Maps API error");
  }

  const element = data.rows?.[0]?.elements?.[0];

  if (!element || element.status !== "OK") {
    throw new Error("Unable to calculate distance");
  }

  // distance.value is in meters
  const meters = element.distance.value;
  const miles = meters / 1609.34;

  return Number(miles.toFixed(2));
}


const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

const UK_CITIES = [
  { name: "London", code: "LON" },
  { name: "Manchester", code: "MAN" },
  { name: "Birmingham", code: "BHM" },
  { name: "Edinburgh", code: "EDI" },
  { name: "Glasgow", code: "GLA" },
  { name: "Leeds", code: "LDS" },
  { name: "Liverpool", code: "LPL" },
  { name: "Bristol", code: "BST" },
  { name: "Sheffield", code: "SHF" },
  { name: "Newcastle", code: "NCL" },
  { name: "Nottingham", code: "NGM" },
  { name: "Leicester", code: "LCE" },
  { name: "Coventry", code: "CVT" },
  { name: "Bradford", code: "BFD" },
  { name: "Cardiff", code: "CDF" },
  { name: "Belfast", code: "BFS" },
  { name: "Southampton", code: "SOU" },
  { name: "Portsmouth", code: "POR" },
  { name: "Oxford", code: "OXF" },
  { name: "Cambridge", code: "CAM" },
];

// Reverse-geocode fromPlaceId → city code

export async function detectCityCode(fromPlaceId) {
  const params = new URLSearchParams({
    place_id: fromPlaceId,
    fields: "address_components",
    key: GOOGLE_KEY,
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data = await response.json();

  const components = data?.result?.address_components || [];

  // Extract city name from address components
  const cityComponent = components.find(
    (c) =>
      c.types.includes("postal_town") ||
      c.types.includes("locality") ||
      c.types.includes("administrative_area_level_2")
  );

  const cityName = cityComponent?.long_name || "";

  // Match against our UK_CITIES list (case-insensitive)
  const matched = UK_CITIES.find((c) =>
    cityName.toLowerCase().includes(c.name.toLowerCase())
  );
  return matched?.code || null;
}
