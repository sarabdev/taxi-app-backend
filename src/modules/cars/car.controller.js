import fs from "fs";
import { Car } from "./car.model.js";
import { calculateDistanceMiles, detectCityCode } from "../pricing/distance.service.js";
import {
  calculatePublicFareOptions,
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
    const fareOptions = calculatePublicFareOptions({
      car,
      distanceMiles,
      pricePerMile,
      returnDistanceMiles,
      returnPricePerMile,
      coupon,
    });

    return {
      ...car.toObject(),
      ...fareOptions,
    };
  });

  return {
    distanceMiles,
    cars: pricedCars,
  };
}
