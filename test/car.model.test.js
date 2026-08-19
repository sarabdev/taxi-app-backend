import test from "node:test";
import assert from "node:assert/strict";
import { Car } from "../src/modules/cars/car.model.js";

function validCar(overrides = {}) {
  return new Car({
    name: "Test car",
    type: "salon_car",
    basePrice: 10,
    airportPricing: {
      EDI: {
        bands: [
          { upToMiles: 10, pricePerMile: 3 },
          { upToMiles: null, pricePerMile: 2.5 },
        ],
      },
      GLA: {
        bands: [{ upToMiles: null, pricePerMile: 3.25 }],
      },
    },
    ...overrides,
  });
}

test("accepts increasing airport bands ending in an unlimited band", () => {
  assert.equal(validCar().validateSync(), undefined);
});

test("provides Edinburgh and Glasgow defaults for existing cars", () => {
  const car = validCar({ airportPricing: undefined });
  assert.equal(car.airportPricing.EDI.bands.length, 2);
  assert.equal(car.airportPricing.GLA.bands.length, 2);
});

test("rejects non-increasing distance limits", () => {
  const car = validCar();
  car.airportPricing.EDI.bands = [
    { upToMiles: 20, pricePerMile: 3 },
    { upToMiles: 10, pricePerMile: 2.5 },
    { upToMiles: null, pricePerMile: 2 },
  ];
  assert.match(
    car.validateSync().message,
    /Distance bands must have increasing limits/
  );
});

test("rejects bands without an unlimited final rate", () => {
  const car = validCar();
  car.airportPricing.GLA.bands = [{ upToMiles: 20, pricePerMile: 3 }];
  assert.match(
    car.validateSync().message,
    /Distance bands must have increasing limits/
  );
});
