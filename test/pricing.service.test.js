import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFare,
  resolvePricePerMile,
} from "../src/modules/pricing/pricing.service.js";

function car(overrides = {}) {
  return {
    name: "Test car",
    basePrice: 10,
    discounts: [],
    airportRates: {
      LON: { pricePerMile: 2 },
      MAN: { pricePerMile: 3 },
    },
    ...overrides,
  };
}

test("uses the configured pickup-city rate", () => {
  assert.equal(resolvePricePerMile(car(), "MAN"), 3);
});

test("one-way fare is base price plus distance times city rate", () => {
  const result = calculateFare({
    car: car(),
    distanceMiles: 5,
    pricePerMile: 2,
  });

  assert.equal(result.breakdown.baseFare, 20);
  assert.equal(result.totalFare, 20);
});

test("return fare uses each leg's city rate before percentage discount", () => {
  const result = calculateFare({
    car: car({
      discounts: [
        {
          type: "PERCENTAGE",
          value: 10,
          condition: "RETURN_TRIP",
          isActive: true,
        },
      ],
    }),
    distanceMiles: 5,
    pricePerMile: 2,
    returnDistanceMiles: 5,
    returnPricePerMile: 3,
    isReturnTrip: true,
  });

  assert.equal(result.breakdown.baseFare, 20);
  assert.equal(result.breakdown.returnBaseFare, 25);
  assert.equal(result.breakdown.carDiscountAmount, 4.5);
  assert.equal(result.totalFare, 40.5);
});

test("fixed return discount remains fixed when return route changes", () => {
  const result = calculateFare({
    car: car({
      discounts: [
        {
          type: "FIXED",
          value: 10,
          condition: "RETURN_TRIP",
          isActive: true,
        },
      ],
    }),
    distanceMiles: 5,
    pricePerMile: 2,
    returnDistanceMiles: 20,
    returnPricePerMile: 3,
    isReturnTrip: true,
  });

  assert.equal(result.breakdown.carDiscountAmount, 10);
  assert.equal(result.totalFare, 80);
});

test("coupon is applied after the car discount and capped", () => {
  const result = calculateFare({
    car: car({
      discounts: [
        {
          type: "PERCENTAGE",
          value: 10,
          condition: "ALWAYS",
          isActive: true,
        },
      ],
    }),
    distanceMiles: 5,
    pricePerMile: 2,
    coupon: {
      code: "SAVE50",
      type: "PERCENTAGE",
      value: 50,
      maxDiscount: 5,
    },
  });

  assert.equal(result.breakdown.carDiscountAmount, 2);
  assert.equal(result.breakdown.couponDiscountAmount, 5);
  assert.equal(result.totalFare, 13);
});
