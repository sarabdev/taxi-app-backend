import { Car } from "./car.model.js";
import fs from "fs";
import { calculateDistanceMiles, detectCityCode } from "../pricing/distance.service.js";

/* ───────────────────── Admin: Create car ───────────────────── */
export async function createCar(req, res) {
  try {
    const payload = req.body;

    if (req.file) {
      payload.image = `/uploads/cars/${req.file.filename}`;
    }

    const car = await Car.create(payload);
    res.json(car);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}

/* ───────────────────── Admin: List cars ───────────────────── */
export async function listCars(_, res) {
  const cars = await Car.find().sort({ createdAt: -1 });
  res.json(cars);
}

/* ───────────────────── Admin: Update car ───────────────────── */
export async function updateCar(req, res) {
  const car = await Car.findById(req.params.id);
  if (!car) {
    return res.status(404).json({ message: "Car not found" });
  }

  // Replace image if new uploaded
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

/* ───────────────────── Admin: Delete car ───────────────────── */
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

/* ───────────────────── Public: List cars (no pricing) ───────────────────── */
export async function listPublicCars(_, res) {
  const cars = await Car.find();
  res.json(cars);
}

/* ───────────────────── Public: Cars with pricing ───────────────────── */
export async function listPublicCarsWithPricing(req) {
  const { fromPlaceId, toPlaceId } = req.body;

  if (!fromPlaceId || !toPlaceId) {
    throw new Error("fromPlaceId and toPlaceId are required");
  }

  /* 1️⃣ Distance */
  const distanceMiles = await calculateDistanceMiles({ fromPlaceId, toPlaceId });

  /* 2️⃣ Detect city code from fromPlaceId */
  const cityCode = await detectCityCode(fromPlaceId);

  /* 3️⃣ Cars */
  const cars = await Car.find();

  /* 4️⃣ Pricing */
  const pricedCars = cars.map((car) => {
    // Look up rate by city code; fall back to null if city not found or no rate
    const cityRate = cityCode ? car.airportRates?.get(cityCode) : { pricePerMile: 3.00 }; // default to 3.00 if city code not detected


    if (!cityRate || cityRate.pricePerMile == null) {
      console.log(
        "[listPublicCarsWithPricing] Skipping car because no city rate or pricePerMile found:",
        car.name
      );

      return null; // skip car if no rate for this city
    }

    const pricePerMile = Number(cityRate.pricePerMile);
    const basePrice = Number(car.basePrice || 0);

    const baseFare = basePrice + distanceMiles * pricePerMile;

    /* ───────── ONE WAY ───────── */
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

    /* ───────── RETURN ───────── */
    const returnDiscount = car.discounts?.find(
      (d) => d.isActive && d.condition === "RETURN_TRIP"
    );

    const supportsReturnTrip = Boolean(returnDiscount);

    let returnOriginal = null;
    let returnTotal = null;
    let returnDiscountAmount = 0;

    if (supportsReturnTrip) {
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
        basePrice,
        pricePerMile,

        // ONE WAY
        oneWayFare: oneWayTotal,
        originalOneWayFare: oneWayDiscount > 0 ? oneWayOriginal : null,
        oneWayDiscountAmount: oneWayDiscount,

        // RETURN
        roundTripFare: returnTotal,
        originalRoundTripFare: returnDiscountAmount > 0 ? returnOriginal : null,
        returnDiscountAmount,
      },
      supportsReturnTrip,
    };
  });

  return {
    distanceMiles,
    cars: pricedCars.filter(Boolean),
  };
}
