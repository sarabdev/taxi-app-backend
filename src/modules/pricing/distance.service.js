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
