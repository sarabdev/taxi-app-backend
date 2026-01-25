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
  isReturnTrip = false,
  couponCode,
}) {
  if (!carId || !distanceMiles || distanceMiles <= 0) {
    throw new Error("Invalid pricing input");
  }

  const car = await Car.findById(carId);
  if (!car) throw new Error("Car not found");

  // 1️⃣ Base fare (PER MILE)
  const baseFare =
    Number(car.basePrice || 0) +
    Number(distanceMiles) * Number(car.pricePerMile || 0);

  let total = baseFare;
  let carDiscountAmount = 0;
  let couponDiscountAmount = 0;

  // 2️⃣ Apply car discount (e.g. return trip)
  const applicableCarDiscount = car.discounts?.find(
    (d) =>
      d.isActive &&
      (d.condition === "ALWAYS" ||
        (d.condition === "RETURN_TRIP" && isReturnTrip))
  );

  if (applicableCarDiscount) {
    carDiscountAmount = applyDiscount(total, applicableCarDiscount);
    total -= carDiscountAmount;
  }

  // 3️⃣ Apply coupon
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

  // 4️⃣ Final safety
  total = Math.max(0, total);

  return {
    breakdown: {
      baseFare,
      distanceMiles,
      pricePerMile: car.pricePerMile,
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
