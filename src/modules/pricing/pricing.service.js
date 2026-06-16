import { Car } from "../cars/car.model.js";
import { Coupon } from "../coupons/coupon.model.js";
import { calculateDistanceMiles } from "./distance.service.js";

function applyDiscount(amount, discount) {
  if (!discount || !discount.isActive) return 0;

  if (discount.type === "PERCENTAGE") {
    return (amount * discount.value) / 100;
  }

  if (discount.type === "FIXED") {
    return discount.value;
  }

  return 0;
}

export async function calculatePrice({
  carId,
  distanceMiles,
  returnDistanceMiles = 0,
  isReturnTrip = false,
  couponCode,
}) {
  if (!carId || !distanceMiles || distanceMiles <= 0) {
    throw new Error("Invalid pricing input");
  }

  const car = await Car.findById(carId);
  if (!car) throw new Error("Car not found");

  /* --------------------------------------------------
     1️⃣ Resolve pricePerMile (airport-aware, backward-safe)
  -------------------------------------------------- */

  let pricePerMile = Number(car.pricePerMile || 0);

  // NEW: if airportRates exist, use a deterministic value
  if (car.airportRates && Object.keys(car.airportRates).length > 0) {
    const rates = Object.values(car.airportRates)
      .map((r) => Number(r.pricePerMile))
      .filter((v) => Number.isFinite(v) && v > 0);

    // Use lowest configured airport rate (safe default)
    if (rates.length > 0) {
      pricePerMile = Math.min(...rates);
    }
  }

  /* --------------------------------------------------
     2️⃣ Base fare
  -------------------------------------------------- */
  const baseFare =
    Number(car.basePrice || 0) +
    Number(distanceMiles) * pricePerMile;

  let total = baseFare;
  let carDiscountAmount = 0;
  let couponDiscountAmount = 0;

  /* --------------------------------------------------
     3️⃣ Car discounts
  -------------------------------------------------- */
  if (isReturnTrip) {
    const returnFare =
      Number(car.basePrice || 0) +
      Number(returnDistanceMiles || distanceMiles) * pricePerMile;

    total = baseFare + returnFare;

    const returnDiscount = car.discounts?.find(
      (d) => d.isActive && d.condition === "RETURN_TRIP"
    );

    if (returnDiscount) {
      carDiscountAmount = applyDiscount(total, returnDiscount);
      total -= carDiscountAmount;
    }
  } else {
    const alwaysDiscount = car.discounts?.find(
      (d) => d.isActive && d.condition === "ALWAYS"
    );

    if (alwaysDiscount) {
      carDiscountAmount = applyDiscount(total, alwaysDiscount);
      total -= carDiscountAmount;
    }
  }

  /* --------------------------------------------------
     4️⃣ Coupon logic (unchanged)
  -------------------------------------------------- */
  let coupon = null;

  if (couponCode) {
    coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      isActive: true,
    });

    if (!coupon) throw new Error("Invalid coupon");
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new Error("Coupon expired");
    }
    if (coupon.minAmount && total < coupon.minAmount) {
      throw new Error("Coupon minimum amount not met");
    }

    couponDiscountAmount =
      coupon.type === "PERCENTAGE"
        ? (total * coupon.value) / 100
        : coupon.value;

    if (coupon.maxDiscount) {
      couponDiscountAmount = Math.min(
        couponDiscountAmount,
        coupon.maxDiscount
      );
    }

    total -= couponDiscountAmount;
  }

  /* --------------------------------------------------
     5️⃣ Final safety
  -------------------------------------------------- */
  total = Math.max(0, total);

  return {
    breakdown: {
      baseFare,
      distanceMiles,
      returnDistanceMiles: Number(returnDistanceMiles || 0),
      pricePerMile,
      carDiscountAmount,
      couponDiscountAmount,
    },
    totalFare: Number(total.toFixed(2)),
    appliedCoupon: coupon ? coupon.code : null,
  };
}





export async function pricingController(req, res) {
  const {
    fromPlaceId,
    toPlaceId,
    carId,
    isReturnTrip,
    couponCode,
  } = req.body;

  const distanceMiles = await calculateDistanceMiles({
    fromPlaceId,
    toPlaceId,
  });

  const price = await calculatePrice({
    carId,
    distanceMiles,
    isReturnTrip,
    couponCode,
  });

  res.json({
    distanceMiles,
    ...price,
  });
}
