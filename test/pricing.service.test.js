import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFare,
  getReusedReturnDistance,
  pricingSnapshotMatchesTotal,
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

test("return percentage discount applies only to the return leg", () => {
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
  assert.equal(result.breakdown.carDiscountAmount, 2.5);
  assert.equal(result.totalFare, 42.5);
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

test("reuses the outbound distance for an exact reversed return route", () => {
  assert.equal(
    getReusedReturnDistance({
      outboundDistanceMiles: 10,
      fromPlaceId: "A",
      toPlaceId: "B",
      returnFromPlaceId: "B",
      returnToPlaceId: "A",
    }),
    10
  );
});

test("does not reuse the outbound distance for a custom return route", () => {
  assert.equal(
    getReusedReturnDistance({
      outboundDistanceMiles: 10,
      fromPlaceId: "A",
      toPlaceId: "B",
      returnFromPlaceId: "C",
      returnToPlaceId: "A",
    }),
    null
  );
});

test("exact return route doubles the fare before a fixed discount", () => {
  const result = calculateFare({
    car: car({
      basePrice: 0,
      discounts: [
        {
          type: "FIXED",
          value: 10,
          condition: "RETURN_TRIP",
          isActive: true,
        },
      ],
    }),
    distanceMiles: 10,
    pricePerMile: 2,
    returnDistanceMiles: 10,
    returnPricePerMile: 2,
    isReturnTrip: true,
  });

  assert.equal(result.breakdown.baseFare, 20);
  assert.equal(result.breakdown.returnBaseFare, 20);
  assert.equal(result.breakdown.carDiscountAmount, 10);
  assert.equal(result.totalFare, 30);
});

test("fixed return discount cannot reduce the outbound fare", () => {
  const result = calculateFare({
    car: car({
      basePrice: 0,
      discounts: [
        {
          type: "FIXED",
          value: 25,
          condition: "RETURN_TRIP",
          isActive: true,
        },
      ],
    }),
    distanceMiles: 10,
    pricePerMile: 2,
    returnDistanceMiles: 5,
    returnPricePerMile: 2,
    isReturnTrip: true,
  });

  assert.equal(result.breakdown.baseFare, 20);
  assert.equal(result.breakdown.returnBaseFare, 10);
  assert.equal(result.breakdown.carDiscountAmount, 10);
  assert.equal(result.totalFare, 20);
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

test("accepts a pricing snapshot whose components match its total", () => {
  assert.equal(
    pricingSnapshotMatchesTotal({
      baseFare: 235.67,
      returnBaseFare: 234.74,
      carDiscountAmount: 47.04,
      couponDiscountAmount: 0,
      totalFare: 423.37,
    }),
    true
  );
});

test("rejects a pricing snapshot whose components do not match its total", () => {
  assert.equal(
    pricingSnapshotMatchesTotal({
      baseFare: 30,
      returnBaseFare: 0,
      carDiscountAmount: 6.006,
      couponDiscountAmount: 0,
      totalFare: 53.99,
    }),
    false
  );
});
