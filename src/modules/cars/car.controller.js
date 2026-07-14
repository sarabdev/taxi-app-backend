import fs from "fs";
import { Car } from "./car.model.js";
import { calculateDistanceMiles, detectCityCode } from "../pricing/distance.service.js";
import { calculateFare, resolvePricePerMile } from "../pricing/pricing.service.js";

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
  const { fromPlaceId, toPlaceId } = req.body;

  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  const [
    distanceMiles,
    returnDistanceMiles,
    cityCode,
    returnCityCode,
    cars,
  ] = await Promise.all([
    calculateDistanceMiles({ fromPlaceId, toPlaceId }),
    calculateDistanceMiles({
      fromPlaceId: toPlaceId,
      toPlaceId: fromPlaceId,
    }),
    detectCityCode(fromPlaceId),
    detectCityCode(toPlaceId),
    Car.find(),
  ]);

  const pricedCars = cars.map((car) => {
    const pricePerMile = resolvePricePerMile(car, cityCode);
    const returnPricePerMile = resolvePricePerMile(car, returnCityCode);
    const oneWayQuote = calculateFare({
      car,
      distanceMiles,
      pricePerMile,
    });
    const supportsReturnTrip = Boolean(
      car.discounts?.find(
        (discount) =>
          discount.isActive && discount.condition === "RETURN_TRIP"
      )
    );
    const returnQuote = supportsReturnTrip
      ? calculateFare({
          car,
          distanceMiles,
          pricePerMile,
          returnDistanceMiles,
          returnPricePerMile,
          isReturnTrip: true,
        })
      : null;
    const originalRoundTripFare = returnQuote
      ? Number(
          (
            returnQuote.breakdown.baseFare +
            returnQuote.breakdown.returnBaseFare
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
          oneWayQuote.breakdown.carDiscountAmount > 0
            ? oneWayQuote.breakdown.baseFare
            : null,
        oneWayDiscountAmount: oneWayQuote.breakdown.carDiscountAmount,
        roundTripFare: returnQuote?.totalFare ?? null,
        originalRoundTripFare:
          returnQuote?.breakdown.carDiscountAmount > 0
            ? originalRoundTripFare
            : null,
        returnDiscountAmount:
          returnQuote?.breakdown.carDiscountAmount || 0,
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
