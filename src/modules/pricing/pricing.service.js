import { Car } from "../cars/car.model.js";
import { findValidCoupon } from "../coupons/coupon.service.js";
import { calculateDistanceMiles, detectCityCode } from "./distance.service.js";

function toMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function pricingSnapshotMatchesTotal(pricing) {
  const values = [
    pricing?.baseFare,
    pricing?.returnBaseFare || 0,
    pricing?.carDiscountAmount || 0,
    pricing?.couponDiscountAmount || 0,
    pricing?.totalFare,
  ].map(Number);

  if (values.some((value) => !Number.isFinite(value))) return false;

  const [baseFare, returnBaseFare, carDiscount, couponDiscount, totalFare] =
    values;
  const recomposedTotal = toMoney(
    baseFare + returnBaseFare - carDiscount - couponDiscount
  );

  return recomposedTotal === toMoney(totalFare);
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

function getConfiguredRates(car) {
  const entries = car.airportRates instanceof Map
    ? [...car.airportRates.entries()]
    : Object.entries(car.airportRates || {});

  return entries
    .map(([code, rate]) => [code, Number(rate?.pricePerMile)])
    .filter(([, rate]) => Number.isFinite(rate) && rate > 0);
}

export function resolvePricePerMile(car, cityCode) {
  const configuredRates = getConfiguredRates(car);
  const selectedRate = configuredRates.find(([code]) => code === cityCode)?.[1];

  if (selectedRate != null) return selectedRate;

  const legacyRate = Number(car.pricePerMile);
  if (Number.isFinite(legacyRate) && legacyRate > 0) return legacyRate;

  if (configuredRates.length > 0) {
    return Math.min(...configuredRates.map(([, rate]) => rate));
  }

  throw new Error(`No per-mile rate configured for ${car.name || "this car"}`);
}

export function calculateFare({
  car,
  distanceMiles,
  pricePerMile,
  returnDistanceMiles = 0,
  returnPricePerMile = 0,
  isReturnTrip = false,
  coupon = null,
}) {
  const outboundDistance = Number(distanceMiles);
  const outboundRate = Number(pricePerMile);
  const basePrice = Number(car.basePrice || 0);

  if (
    !Number.isFinite(outboundDistance) ||
    outboundDistance <= 0 ||
    !Number.isFinite(outboundRate) ||
    outboundRate <= 0 ||
    !Number.isFinite(basePrice) ||
    basePrice < 0
  ) {
    throw new Error("Invalid pricing input");
  }

  const baseFare = toMoney(basePrice + outboundDistance * outboundRate);
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

    returnBaseFare = toMoney(basePrice + inboundDistance * inboundRate);
    total = toMoney(baseFare + returnBaseFare);

    const returnDiscount = car.discounts?.find(
      (discount) => discount.isActive && discount.condition === "RETURN_TRIP"
    );

    carDiscountAmount = applyDiscount(total, returnDiscount);
  } else {
    const alwaysDiscount = car.discounts?.find(
      (discount) => discount.isActive && discount.condition === "ALWAYS"
    );

    carDiscountAmount = applyDiscount(total, alwaysDiscount);
  }

  total = toMoney(Math.max(0, total - carDiscountAmount));

  let couponDiscountAmount = 0;
  if (coupon) {
    if (coupon.minAmount && total < Number(coupon.minAmount)) {
      throw new Error("Coupon minimum amount not met");
    }

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
  }

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
    },
    totalFare: total,
    appliedCoupon: coupon?.code || null,
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
}) {
  if (!carId || !fromPlaceId || !toPlaceId) {
    throw new Error("carId, fromPlaceId and toPlaceId are required");
  }

  const outboundPromise = Promise.all([
    calculateDistanceMiles({ fromPlaceId, toPlaceId }),
    detectCityCode(fromPlaceId),
  ]);

  const inboundFrom = returnFromPlaceId || toPlaceId;
  const inboundTo = returnToPlaceId || fromPlaceId;
  const inboundPromise = isReturnTrip
    ? Promise.all([
        calculateDistanceMiles({
          fromPlaceId: inboundFrom,
          toPlaceId: inboundTo,
        }),
        detectCityCode(inboundFrom),
      ])
    : Promise.resolve([0, null]);

  const [car, [distanceMiles, cityCode], [returnDistanceMiles, returnCityCode], coupon] =
    await Promise.all([
      Car.findById(carId),
      outboundPromise,
      inboundPromise,
      findCoupon(couponCode),
    ]);

  if (!car) throw new Error("Car not found");

  return calculateFare({
    car,
    distanceMiles,
    pricePerMile: resolvePricePerMile(car, cityCode),
    returnDistanceMiles,
    returnPricePerMile: isReturnTrip
      ? resolvePricePerMile(car, returnCityCode)
      : 0,
    isReturnTrip,
    coupon,
  });
}
