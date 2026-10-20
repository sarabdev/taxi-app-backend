import fetch from "node-fetch";

export const SCOTLAND_AIRPORTS = [
  { code: "EDI", name: "Edinburgh Airport", coordinates: "55.9500,-3.3725" },
  { code: "GLA", name: "Glasgow Airport", coordinates: "55.8719,-4.4331" },
];

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Google Distance Matrix allows up to 100 elements (origins × destinations) per
// request. With N intermediate stops a context lookup needs
// (N + 2) origins × (N + 1 + airports) destinations, so this keeps us well
// within that limit while covering any realistic multi-stop journey.
export const MAX_STOPS = 5;

/**
 * Cleans an arbitrary stops payload into an ordered list of non-empty place ids,
 * capped at MAX_STOPS. Shared by every caller so the priced route, the payment
 * metadata and the stored booking always agree on the exact same waypoints.
 */
export function normalizeStopPlaceIds(stopPlaceIds) {
  if (!Array.isArray(stopPlaceIds)) return [];

  return stopPlaceIds
    .map((value) =>
      typeof value === "object" && value !== null
        ? String(value.placeId || "").trim()
        : String(value || "").trim()
    )
    .filter(Boolean)
    .slice(0, MAX_STOPS);
}

function toPlaceParams(placeIds) {
  return placeIds.map((placeId) => `place_id:${placeId}`);
}

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
 * Sums the consecutive legs of a route whose points are passed as both the
 * origins (every point except the last) and destinations (every point except
 * the first). Leg i is therefore the diagonal element rows[i].elements[i].
 */
function sumRouteLegMiles(rows, legCount) {
  let total = 0;

  for (let legIndex = 0; legIndex < legCount; legIndex += 1) {
    const legMiles = elementMiles(rows?.[legIndex]?.elements?.[legIndex]);
    if (legMiles === null) return null;
    total += legMiles;
  }

  return Number(total.toFixed(2));
}

/**
 * Calculate total journey distance in miles using Google Distance Matrix,
 * summing every leg of from → stops → to. With no stops this is a single
 * from → to leg, identical to the original behaviour.
 */
export async function calculateDistanceMiles({
  fromPlaceId,
  toPlaceId,
  stopPlaceIds = [],
}) {
  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  const stops = normalizeStopPlaceIds(stopPlaceIds);
  const points = [fromPlaceId, ...stops, toPlaceId];

  const rows = await fetchDistanceMatrix({
    origins: toPlaceParams(points.slice(0, -1)),
    destinations: toPlaceParams(points.slice(1)),
  });
  const miles = sumRouteLegMiles(rows, points.length - 1);

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
 * The journey distance is the sum of every leg of from → stops → to, and every
 * route point (pickup, each stop and drop-off) is compared to the airports so an
 * explicitly used airport always wins. With no stops this is identical to the
 * original two-point lookup.
 */
export async function calculateRoutePricingContext({
  fromPlaceId,
  toPlaceId,
  stopPlaceIds = [],
}) {
  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  const stops = normalizeStopPlaceIds(stopPlaceIds);
  const points = [fromPlaceId, ...stops, toPlaceId];
  const nextPoints = points.slice(1);

  const [rows, pickupPlace, dropoffPlace] = await Promise.all([
    fetchDistanceMatrix({
      // Origins are every route point so each one can be measured against the
      // airports; destinations are the "next" point of each leg followed by the
      // airports. Leg i is then rows[i].elements[i].
      origins: toPlaceParams(points),
      destinations: [
        ...toPlaceParams(nextPoints),
        ...SCOTLAND_AIRPORTS.map((airport) => airport.coordinates),
      ],
    }),
    fetchPlaceDetails(fromPlaceId),
    fetchPlaceDetails(toPlaceId),
  ]);
  const distanceMiles = sumRouteLegMiles(rows, points.length - 1);

  if (distanceMiles === null) {
    throw new Error("Unable to calculate distance");
  }

  const airportDistances = Object.fromEntries(
    SCOTLAND_AIRPORTS.map((airport, airportIndex) => {
      const destinationIndex = nextPoints.length + airportIndex;
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
