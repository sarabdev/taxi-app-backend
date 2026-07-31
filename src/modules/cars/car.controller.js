import fs from "fs";
import { Car } from "./car.model.js";
import { calculateDistanceMiles, detectCityCode } from "../pricing/distance.service.js";
import {
  calculateFare,
  getReusedReturnDistance,
  resolvePricePerMile,
} from "../pricing/pricing.service.js";
import { findValidCoupon } from "../coupons/coupon.service.js";

export async function createCar(req, res) {
  try {
    const payload = req.body;

    if (req.file) {
      payload.image = `/uploads/cars/${req.file.filename}`;
    }

    const car = await Car.create(payload);
    res.json(car);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function listCars(_, res) {
  const cars = await Car.find().sort({ createdAt: -1 });
  res.json(cars);
}

export async function updateCar(req, res) {
  const car = await Car.findById(req.params.id);
  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  if (req.file) {
    if (car.image) {
      const oldPath = car.image.replace("/", "");
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    car.image = `/uploads/cars/${req.file.filename}`;
  }

  Object.assign(car, req.body);
  await car.save();

  res.json(car);
}

export async function deleteCar(req, res) {
  const car = await Car.findById(req.params.id);
  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  if (car.image) {
    const imagePath = car.image.replace("/", "");
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }

  await car.deleteOne();
  res.json({ message: "Deleted" });
}

export async function listPublicCars(_, res) {
  const cars = await Car.find();
  res.json(cars);
}

export async function listPublicCarsWithPricing(req) {
  const { fromPlaceId, toPlaceId, couponCode } = req.body;

  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  const [
    distanceMiles,
    cityCode,
    returnCityCode,
    cars,
    coupon,
  ] = await Promise.all([
    calculateDistanceMiles({ fromPlaceId, toPlaceId }),
    detectCityCode(fromPlaceId),
    detectCityCode(toPlaceId),
    Car.find(),
    couponCode ? findValidCoupon(couponCode) : Promise.resolve(null),
  ]);
  const returnDistanceMiles = getReusedReturnDistance({
    outboundDistanceMiles: distanceMiles,
    fromPlaceId,
    toPlaceId,
    returnFromPlaceId: toPlaceId,
    returnToPlaceId: fromPlaceId,
  });

  const pricedCars = cars.map((car) => {
    const pricePerMile = resolvePricePerMile(car, cityCode);
    const returnPricePerMile = resolvePricePerMile(car, returnCityCode);
    const oneWayBaseQuote = calculateFare({
      car,
      distanceMiles,
      pricePerMile,
    });
    const oneWayCouponEligible =
      coupon &&
      (!coupon.minAmount ||
        oneWayBaseQuote.totalFare >= Number(coupon.minAmount));
    const oneWayQuote = oneWayCouponEligible
      ? calculateFare({ car, distanceMiles, pricePerMile, coupon })
      : oneWayBaseQuote;
    const supportsReturnTrip = Boolean(
      car.discounts?.find(
        (discount) =>
          discount.isActive && discount.condition === "RETURN_TRIP"
      )
    );
    const returnBaseQuote = supportsReturnTrip
      ? calculateFare({
          car,
          distanceMiles,
          pricePerMile,
          returnDistanceMiles,
          returnPricePerMile,
          isReturnTrip: true,
        })
      : null;
    const returnCouponEligible =
      coupon &&
      returnBaseQuote &&
      (!coupon.minAmount ||
        returnBaseQuote.totalFare >= Number(coupon.minAmount));
    const returnQuote = returnCouponEligible
      ? calculateFare({
          car,
          distanceMiles,
          pricePerMile,
          returnDistanceMiles,
          returnPricePerMile,
          isReturnTrip: true,
          coupon,
        })
      : returnBaseQuote;
    const originalRoundTripFare = returnBaseQuote
      ? Number(
          (
            returnBaseQuote.breakdown.baseFare +
            returnBaseQuote.breakdown.returnBaseFare
          ).toFixed(2)
        )
      : null;

    return {
      ...car.toObject(),
      pricing: {
        distanceMiles,
        basePrice: Number(car.basePrice || 0),
        pricePerMile,
        returnPricePerMile,
        oneWayFare: oneWayQuote.totalFare,
        originalOneWayFare:
          oneWayQuote.breakdown.couponDiscountAmount > 0
            ? oneWayBaseQuote.totalFare
            : oneWayQuote.breakdown.carDiscountAmount > 0
              ? oneWayQuote.breakdown.baseFare
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
              ? originalRoundTripFare
              : null,
        returnDiscountAmount:
          returnQuote?.breakdown.carDiscountAmount || 0,
        returnCouponDiscountAmount:
          returnQuote?.breakdown.couponDiscountAmount || 0,
        returnAppliedCoupon: returnQuote?.appliedCoupon || null,
        returnDistanceMiles: returnQuote?.breakdown.returnDistanceMiles || 0,
      },
      supportsReturnTrip,
    };
  });

  return {
    distanceMiles,
    cars: pricedCars,
  };
}
