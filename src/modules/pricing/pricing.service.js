import { Car } from "../cars/car.model.js";
import { findValidCoupon } from "../coupons/coupon.service.js";
import { calculateRoutePricingContext } from "./distance.service.js";
import {
  getAirportPickupFee,
  getMeetAndGreetPrice,
} from "../settings/settings.service.js";

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function toWholePrice(value) {
  return Math.round(toMoney(value));
}

export function pricingSnapshotMatchesTotal(pricing) {
  const values = [
    pricing?.baseFare,
    pricing?.returnBaseFare || 0,
    pricing?.carDiscountAmount || 0,
    pricing?.couponDiscountAmount || 0,
    pricing?.meetAndGreetFee || 0,
    pricing?.airportPickupFee || 0,
    pricing?.totalFare,
  ].map(Number);

  if (values.some((value) => !Number.isFinite(value))) return false;

  const [
    baseFare,
    returnBaseFare,
    carDiscount,
    couponDiscount,
    meetAndGreetFee,
    airportPickupFee,
    totalFare,
  ] =
    values;
  const recomposedTotal = toMoney(
    baseFare +
      returnBaseFare -
      carDiscount -
      couponDiscount +
      meetAndGreetFee +
      airportPickupFee
  );

  const suppliedTotal = toMoney(totalFare);

  // Accept existing two-decimal payment snapshots as well as newly rounded
  // totals so payments already in progress remain valid during deployment.
  return (
    recomposedTotal === suppliedTotal ||
    toWholePrice(recomposedTotal) === suppliedTotal
  );
}

function applyDiscount(amount, discount) {
  if (!discount?.isActive || amount <= 0) return 0;

  const value = Number(discount.value);
  if (!Number.isFinite(value) || value <= 0) return 0;

  const discountAmount =
    discount.type === "PERCENTAGE"
      ? (amount * Math.min(value, 100)) / 100
      : discount.type === "FIXED"
        ? value
        : 0;

  return toMoney(Math.min(amount, discountAmount));
}

export function calculateLegFare({ car, distanceMiles, pricePerMile }) {
  const distance = Number(distanceMiles);
  const rate = Number(pricePerMile);
  const basePrice = Number(car.basePrice || 0);

  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !Number.isFinite(basePrice) ||
    basePrice < 0
  ) {
    throw new Error("Invalid pricing input");
  }

  return toMoney(basePrice + distance * rate);
}

export function resolvePricePerMile(car, airportCode, distanceMiles) {
  const distance = Number(distanceMiles);
  const bands = car.airportPricing?.[airportCode]?.bands;

  if (!Number.isFinite(distance) || distance <= 0) {
    throw new Error("Invalid journey distance");
  }

  if (!Array.isArray(bands) || bands.length === 0) {
    throw new Error(
      `No ${airportCode || "airport"} distance bands configured for ${car.name || "this car"}`
    );
  }

  const matchingBand = bands.find((band) => {
    const limit = band.upToMiles;
    return limit == null || distance <= Number(limit);
  });
  const rate = Number(matchingBand?.pricePerMile);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(
      `No distance band covers ${distance} miles for ${car.name || "this car"}`
    );
  }

  return rate;
}

export function isExactReverseRoute({
  fromPlaceId,
  toPlaceId,
  returnFromPlaceId,
  returnToPlaceId,
}) {
  return (
    Boolean(fromPlaceId && toPlaceId && returnFromPlaceId && returnToPlaceId) &&
    returnFromPlaceId === toPlaceId &&
    returnToPlaceId === fromPlaceId
  );
}

export function getReusedReturnDistance({
  outboundDistanceMiles,
  ...route
}) {
  return isExactReverseRoute(route) ? Number(outboundDistanceMiles) : null;
}

export function calculateFare({
  car,
  distanceMiles,
  pricePerMile,
  returnDistanceMiles = 0,
  returnPricePerMile = 0,
  isReturnTrip = false,
  coupon = null,
  meetAndGreetFee = 0,
  airportPickupFee = 0,
}) {
  const outboundDistance = Number(distanceMiles);
  const outboundRate = Number(pricePerMile);
  const basePrice = Number(car.basePrice || 0);
  const baseFare = calculateLegFare({
    car,
    distanceMiles: outboundDistance,
    pricePerMile: outboundRate,
  });
  let returnBaseFare = 0;
  let total = baseFare;
  let carDiscountAmount = 0;

  if (isReturnTrip) {
    const inboundDistance = Number(returnDistanceMiles);
    const inboundRate = Number(returnPricePerMile);

    if (
      !Number.isFinite(inboundDistance) ||
      inboundDistance <= 0 ||
      !Number.isFinite(inboundRate) ||
      inboundRate <= 0
    ) {
      throw new Error("Invalid return pricing input");
    }

    returnBaseFare = calculateLegFare({
      car,
      distanceMiles: inboundDistance,
      pricePerMile: inboundRate,
    });
    total = toMoney(baseFare + returnBaseFare);

    const returnDiscount = car.discounts?.find(
      (discount) => discount.isActive && discount.condition === "RETURN_TRIP"
    );

    carDiscountAmount = applyDiscount(returnBaseFare, returnDiscount);
  } else {
    const alwaysDiscount = car.discounts?.find(
      (discount) => discount.isActive && discount.condition === "ALWAYS"
    );

    carDiscountAmount = applyDiscount(total, alwaysDiscount);
  }

  total = toMoney(Math.max(0, total - carDiscountAmount));

  let couponDiscountAmount = 0;
  let appliedCoupon = null;
  const couponEligibilityAmount = isReturnTrip ? baseFare : total;
  const couponEligible =
    coupon &&
    (!coupon.minAmount ||
      couponEligibilityAmount >= Number(coupon.minAmount));

  if (couponEligible) {
    couponDiscountAmount = applyDiscount(total, {
      ...coupon,
      isActive: true,
    });

    if (coupon.maxDiscount != null) {
      couponDiscountAmount = Math.min(
        couponDiscountAmount,
        Number(coupon.maxDiscount)
      );
    }

    couponDiscountAmount = toMoney(Math.min(total, couponDiscountAmount));
    total = toMoney(Math.max(0, total - couponDiscountAmount));
    appliedCoupon = coupon.code || null;
  }

  const serviceFee = toMoney(Math.max(0, Number(meetAndGreetFee) || 0));
  const pickupFee = toMoney(Math.max(0, Number(airportPickupFee) || 0));
  total = toWholePrice(total + serviceFee + pickupFee);

  return {
    breakdown: {
      basePrice,
      baseFare,
      returnBaseFare,
      distanceMiles: outboundDistance,
      returnDistanceMiles: isReturnTrip ? Number(returnDistanceMiles) : 0,
      pricePerMile: outboundRate,
      returnPricePerMile: isReturnTrip ? Number(returnPricePerMile) : 0,
      carDiscountAmount,
      couponDiscountAmount,
      meetAndGreetFee: serviceFee,
      airportPickupFee: pickupFee,
    },
    totalFare: total,
    appliedCoupon,
  };
}

export function calculatePublicFareOptions({
  car,
  distanceMiles,
  pricePerMile,
  airportCode,
  outboundAirportPickupFee = 0,
  returnDistanceMiles,
  returnPricePerMile,
  returnAirportCode,
  returnAirportPickupFee = 0,
  coupon = null,
}) {
  const oneWayBaseQuote = calculateFare({
    car,
    distanceMiles,
    pricePerMile,
    airportPickupFee: outboundAirportPickupFee,
  });
  const oneWayQuote = calculateFare({
    car,
    distanceMiles,
    pricePerMile,
    coupon,
    airportPickupFee: outboundAirportPickupFee,
  });
  const supportsReturnTrip = Boolean(
    car.discounts?.find(
      (discount) =>
        discount.isActive && discount.condition === "RETURN_TRIP"
    )
  );
  const returnInput = {
    car,
    distanceMiles,
    pricePerMile,
    returnDistanceMiles,
    returnPricePerMile,
    isReturnTrip: true,
    airportPickupFee:
      Number(outboundAirportPickupFee) + Number(returnAirportPickupFee),
  };
  const returnBaseQuote = supportsReturnTrip
    ? calculateFare(returnInput)
    : null;
  const returnQuote = supportsReturnTrip
    ? calculateFare({ ...returnInput, coupon })
    : null;
  const undiscountedRoundTripFare = returnBaseQuote
    ? toMoney(
        returnBaseQuote.breakdown.baseFare +
          returnBaseQuote.breakdown.returnBaseFare +
          returnBaseQuote.breakdown.airportPickupFee
      )
    : null;

  return {
    supportsReturnTrip,
    pricing: {
      distanceMiles,
      basePrice: Number(car.basePrice || 0),
      airportCode,
      pricePerMile,
      returnPricePerMile,
      returnAirportCode,
      oneWayFare: oneWayQuote.totalFare,
      originalOneWayFare:
        oneWayQuote.breakdown.couponDiscountAmount > 0
          ? oneWayBaseQuote.totalFare
          : oneWayQuote.breakdown.carDiscountAmount > 0
            ? toMoney(
                oneWayQuote.breakdown.baseFare +
                  oneWayQuote.breakdown.airportPickupFee
              )
            : null,
      oneWayDiscountAmount: oneWayQuote.breakdown.carDiscountAmount,
      oneWayCouponDiscountAmount:
        oneWayQuote.breakdown.couponDiscountAmount,
      oneWayAppliedCoupon: oneWayQuote.appliedCoupon,
      roundTripFare: returnQuote?.totalFare ?? null,
      originalRoundTripFare:
        returnQuote?.breakdown.couponDiscountAmount > 0
          ? returnBaseQuote.totalFare
          : returnQuote?.breakdown.carDiscountAmount > 0
            ? undiscountedRoundTripFare
            : null,
      returnDiscountAmount:
        returnQuote?.breakdown.carDiscountAmount || 0,
      returnCouponDiscountAmount:
        returnQuote?.breakdown.couponDiscountAmount || 0,
      returnAppliedCoupon: returnQuote?.appliedCoupon || null,
      returnDistanceMiles:
        returnQuote?.breakdown.returnDistanceMiles || 0,
    },
  };
}

async function findCoupon(couponCode) {
  if (!couponCode) return null;
  return findValidCoupon(couponCode);
}

export async function calculatePrice({
  carId,
  fromPlaceId,
  toPlaceId,
  returnFromPlaceId,
  returnToPlaceId,
  isReturnTrip = false,
  couponCode,
  meetAndGreet = false,
}) {
  if (!carId || !fromPlaceId || !toPlaceId) {
    throw new Error("carId, fromPlaceId and toPlaceId are required");
  }

  const outboundPromise = calculateRoutePricingContext({
    fromPlaceId,
    toPlaceId,
  });

  const inboundFrom = returnFromPlaceId || toPlaceId;
  const inboundTo = returnToPlaceId || fromPlaceId;
  const shouldReuseOutboundDistance = isExactReverseRoute({
    fromPlaceId,
    toPlaceId,
    returnFromPlaceId: inboundFrom,
    returnToPlaceId: inboundTo,
  });
  const inboundPromise = isReturnTrip
    ? shouldReuseOutboundDistance
      ? outboundPromise
      : calculateRoutePricingContext({
          fromPlaceId: inboundFrom,
          toPlaceId: inboundTo,
        })
    : Promise.resolve({ distanceMiles: 0, airportCode: null });

  const [
    car,
    outboundContext,
    returnContext,
    coupon,
    configuredMeetAndGreetPrice,
    configuredAirportPickupFee,
  ] =
    await Promise.all([
      Car.findById(carId),
      outboundPromise,
      inboundPromise,
      findCoupon(couponCode),
      meetAndGreet ? getMeetAndGreetPrice() : Promise.resolve(0),
      getAirportPickupFee(),
    ]);

  if (!car) throw new Error("Car not found");

  const { distanceMiles, airportCode } = outboundContext;
  const {
    distanceMiles: returnDistanceMiles,
    airportCode: returnAirportCode,
  } = returnContext;
  const outboundAirportPickupFee = outboundContext.pickupAirportCode
    ? configuredAirportPickupFee
    : 0;
  const returnPickupAirportCode = shouldReuseOutboundDistance
    ? outboundContext.dropoffAirportCode
    : returnContext.pickupAirportCode;
  const returnAirportPickupFee =
    isReturnTrip && returnPickupAirportCode ? configuredAirportPickupFee : 0;

  const fare = calculateFare({
    car,
    distanceMiles,
    pricePerMile: resolvePricePerMile(car, airportCode, distanceMiles),
    returnDistanceMiles,
    returnPricePerMile: isReturnTrip
      ? resolvePricePerMile(car, returnAirportCode, returnDistanceMiles)
      : 0,
    isReturnTrip,
    coupon,
    meetAndGreetFee: meetAndGreet ? configuredMeetAndGreetPrice : 0,
    airportPickupFee:
      Number(outboundAirportPickupFee) + Number(returnAirportPickupFee),
  });

  return {
    ...fare,
    airportCode,
    returnAirportCode: isReturnTrip ? returnAirportCode : null,
  };
}
