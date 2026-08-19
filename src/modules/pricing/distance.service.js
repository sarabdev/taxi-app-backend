import fetch from "node-fetch";

export const SCOTLAND_AIRPORTS = [
  { code: "EDI", name: "Edinburgh Airport", coordinates: "55.9500,-3.3725" },
  { code: "GLA", name: "Glasgow Airport", coordinates: "55.8719,-4.4331" },
];

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function fetchDistanceMatrix({ origins, destinations }) {
  const params = new URLSearchParams({
    origins: origins.join("|"),
    destinations: destinations.join("|"),
    units: "imperial",
    key: GOOGLE_KEY,
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`
  );
  const data = await res.json();

  if (!res.ok || data.status !== "OK") {
    throw new Error("Google Maps API error");
  }

  return data.rows;
}

function elementMiles(element) {
  if (!element || element.status !== "OK") return null;
  return Number((element.distance.value / 1609.34).toFixed(2));
}

async function fetchPlaceDetails(placeId) {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: "name,types",
    key: GOOGLE_KEY,
  });
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
  );
  const data = await response.json();

  if (!response.ok || data.status !== "OK") {
    throw new Error("Google Places API error");
  }

  return data.result;
}

export function supportedAirportCodeFromPlace(place) {
  const name = String(place?.name || "").toLowerCase();
  const types = Array.isArray(place?.types) ? place.types : [];

  if (!types.includes("airport")) return null;
  if (name.includes("edinburgh airport")) return "EDI";
  if (name.includes("glasgow airport")) return "GLA";
  return null;
}
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

  const rows = await fetchDistanceMatrix({
    origins: [`place_id:${fromPlaceId}`],
    destinations: [`place_id:${toPlaceId}`],
  });
  const miles = elementMiles(rows?.[0]?.elements?.[0]);

  if (miles === null) {
    throw new Error("Unable to calculate distance");
  }

  return miles;
}

export function selectNearestAirportCode(airportDistances) {
  const candidates = SCOTLAND_AIRPORTS.map((airport) => ({
    code: airport.code,
    distance: Number(airportDistances?.[airport.code]),
  })).filter(({ distance }) => Number.isFinite(distance) && distance >= 0);

  if (candidates.length !== SCOTLAND_AIRPORTS.length) {
    throw new Error("Unable to determine the nearest airport");
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0].code;
}

/**
 * Gets the booked distance and the nearest supported airport in one API call.
 * Both route endpoints are compared so an explicitly used airport always wins.
 */
export async function calculateRoutePricingContext({ fromPlaceId, toPlaceId }) {
  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  const [rows, pickupPlace, dropoffPlace] = await Promise.all([
    fetchDistanceMatrix({
      origins: [`place_id:${fromPlaceId}`, `place_id:${toPlaceId}`],
      destinations: [
        `place_id:${toPlaceId}`,
        ...SCOTLAND_AIRPORTS.map((airport) => airport.coordinates),
      ],
    }),
    fetchPlaceDetails(fromPlaceId),
    fetchPlaceDetails(toPlaceId),
  ]);
  const distanceMiles = elementMiles(rows?.[0]?.elements?.[0]);

  if (distanceMiles === null) {
    throw new Error("Unable to calculate distance");
  }

  const airportDistances = Object.fromEntries(
    SCOTLAND_AIRPORTS.map((airport, airportIndex) => {
      const destinationIndex = airportIndex + 1;
      const endpointDistances = rows.map((row) =>
        elementMiles(row?.elements?.[destinationIndex])
      );
      const validDistances = endpointDistances.filter((value) => value !== null);
      return [airport.code, Math.min(...validDistances)];
    })
  );

  return {
    distanceMiles,
    airportCode: selectNearestAirportCode(airportDistances),
    pickupAirportCode: supportedAirportCodeFromPlace(pickupPlace),
    dropoffAirportCode: supportedAirportCodeFromPlace(dropoffPlace),
  };
}
