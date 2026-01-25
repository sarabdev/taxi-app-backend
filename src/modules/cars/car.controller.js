import { Car } from "./car.model.js";
import fs from "fs";
import { calculateDistanceMiles } from "../pricing/distance.service.js";
/**
 * Admin: Create car
 */
export async function createCar(req, res) {
  const payload = req.body;

  if (req.file) {
    payload.image = `/uploads/cars/${req.file.filename}`;
  }

  const car = await Car.create(payload);
  res.json(car);
}

/**
 * Admin: List cars
 */
export async function listCars(_, res) {
  const cars = await Car.find().sort({ createdAt: -1 });
  res.json(cars);
}

/**
 * Admin: Update car
 */
export async function updateCar(req, res) {
  const car = await Car.findById(req.params.id);
  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  // If new image uploaded → remove old one
  if (req.file) {
    if (car.image) {
      const oldPath = car.image.replace("/", "");
      fs.existsSync(oldPath) && fs.unlinkSync(oldPath);
    }
    car.image = `/uploads/cars/${req.file.filename}`;
  }

  Object.assign(car, req.body);
  await car.save();

  res.json(car);
}

/**
 * Admin: Delete car
 */
export async function deleteCar(req, res) {
  const car = await Car.findById(req.params.id);
  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  if (car.image) {
    const imgPath = car.image.replace("/", "");
    fs.existsSync(imgPath) && fs.unlinkSync(imgPath);
  }

  await car.deleteOne();

  res.json({ message: "Deleted" });
}

/**
 * Public: List cars
 */
export async function listPublicCars(_, res) {
  const cars = await Car.find();
  res.json(cars);
}


export async function listPublicCarsWithPricing(req) {
  const { fromPlaceId, toPlaceId } = req.body;

  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  // 1️⃣ Calculate distance
  const distanceMiles = await calculateDistanceMiles({
    fromPlaceId,
    toPlaceId,
  });

  // 2️⃣ Fetch cars
  const cars = await Car.find();

  // 3️⃣ Apply pricing
  const pricedCars = cars.map((car) => {
    const baseFare =
      Number(car.basePrice || 0) +
      Number(distanceMiles) * Number(car.pricePerMile || 0);

    /* ---------------- ONE WAY ---------------- */

    let oneWayOriginal = Number(baseFare.toFixed(2));
    let oneWayTotal = oneWayOriginal;
    let oneWayDiscount = 0;

    const alwaysDiscount = car.discounts?.find(
      (d) => d.isActive && d.condition === "ALWAYS"
    );

    if (alwaysDiscount) {
      oneWayDiscount =
        alwaysDiscount.type === "PERCENTAGE"
          ? (oneWayTotal * alwaysDiscount.value) / 100
          : alwaysDiscount.value;

      oneWayTotal -= oneWayDiscount;
    }

    oneWayTotal = Math.max(0, Number(oneWayTotal.toFixed(2)));

    /* ---------------- RETURN ---------------- */

    const returnDiscount = car.discounts?.find(
      (d) => d.isActive && d.condition === "RETURN_TRIP"
    );

    const supportsReturnTrip = Boolean(returnDiscount);

    let returnOriginal = null;
    let returnTotal = null;
    let returnDiscountAmount = 0;

    if (supportsReturnTrip) {
      // base return = 2x one-way original
      returnOriginal = Number((oneWayOriginal * 2).toFixed(2));
      returnTotal = returnOriginal;

      returnDiscountAmount =
        returnDiscount.type === "PERCENTAGE"
          ? (returnTotal * returnDiscount.value) / 100
          : returnDiscount.value;

      returnTotal -= returnDiscountAmount;
      returnTotal = Math.max(0, Number(returnTotal.toFixed(2)));
    }

    return {
      ...car.toObject(),
      pricing: {
        distanceMiles,
        pricePerMile: car.pricePerMile,
        basePrice: car.basePrice,

        // ONE WAY
        oneWayFare: oneWayTotal,
        originalOneWayFare:
          oneWayDiscount > 0 ? oneWayOriginal : null,
        oneWayDiscountAmount: oneWayDiscount,

        // RETURN
        roundTripFare: returnTotal,
        originalRoundTripFare:
          returnDiscountAmount > 0 ? returnOriginal : null,
        returnDiscountAmount,
      },
      supportsReturnTrip, // 👈 frontend toggle
    };
  });

  return {
    distanceMiles,
    cars: pricedCars,
  };
}
