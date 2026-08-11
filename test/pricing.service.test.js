import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFare,
  calculateLegFare,
  calculatePublicFareOptions,
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

test("uses the fixed up-to-5-mile price at the 5-mile boundary", () => {
  assert.equal(
    calculateLegFare({
      car: car({
        fixedPriceUpTo5Miles: 24,
        fixedPriceUpTo10Miles: 38,
      }),
      distanceMiles: 5,
      pricePerMile: 2,
    }),
    24
  );
});

test("uses the fixed 5-to-10-mile price above 5 through 10 miles", () => {
  const pricedCar = car({
    fixedPriceUpTo5Miles: 24,
    fixedPriceUpTo10Miles: 38,
  });

  assert.equal(
    calculateLegFare({ car: pricedCar, distanceMiles: 5.01, pricePerMile: 2 }),
    38
  );
  assert.equal(
    calculateLegFare({ car: pricedCar, distanceMiles: 10, pricePerMile: 2 }),
    38
  );
});

test("uses base plus per-mile pricing above 10 miles", () => {
  assert.equal(
    calculateLegFare({
      car: car({
        fixedPriceUpTo5Miles: 24,
        fixedPriceUpTo10Miles: 38,
      }),
      distanceMiles: 10.01,
      pricePerMile: 2,
    }),
    30.02
  );
});

test("falls back to per-mile pricing when a fixed band is not configured", () => {
  assert.equal(
    calculateLegFare({
      car: car(),
      distanceMiles: 4,
      pricePerMile: 2,
    }),
    18
  );

  assert.equal(
    calculateLegFare({
      car: car({ fixedPriceUpTo10Miles: 38 }),
      distanceMiles: 4,
      pricePerMile: 2,
    }),
    18
  );
});

test("prices outbound and return legs using their matching distance bands", () => {
  const result = calculateFare({
    car: car({
      fixedPriceUpTo5Miles: 24,
      fixedPriceUpTo10Miles: 38,
    }),
    distanceMiles: 4,
    pricePerMile: 2,
    returnDistanceMiles: 8,
    returnPricePerMile: 3,
    isReturnTrip: true,
  });

  assert.equal(result.breakdown.baseFare, 24);
  assert.equal(result.breakdown.returnBaseFare, 38);
  assert.equal(result.totalFare, 62);
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
  assert.equal(result.totalFare, 43);
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

test("Meet & Greet is added as a fixed service fee after discounts", () => {
  const result = calculateFare({
    car: car(),
    distanceMiles: 5,
    pricePerMile: 2,
    meetAndGreetFee: 12.5,
    coupon: {
      code: "SAVE50",
      type: "PERCENTAGE",
      value: 50,
    },
  });

  assert.equal(result.breakdown.baseFare, 20);
  assert.equal(result.breakdown.couponDiscountAmount, 10);
  assert.equal(result.breakdown.meetAndGreetFee, 12.5);
  assert.equal(result.totalFare, 23);
});

test("coupon below its minimum spend is skipped without leaving stale pricing", () => {
  const result = calculateFare({
    car: car(),
    distanceMiles: 5,
    pricePerMile: 2,
    coupon: {
      code: "MINIMUM50",
      type: "PERCENTAGE",
      value: 20,
      minAmount: 50,
    },
  });

  assert.equal(result.totalFare, 20);
  assert.equal(result.breakdown.couponDiscountAmount, 0);
  assert.equal(result.appliedCoupon, null);
  assert.equal(pricingSnapshotMatchesTotal({
    ...result.breakdown,
    totalFare: result.totalFare,
  }), true);
});

test("return fare cannot make an ineligible one-way fare meet the voucher minimum", () => {
  const result = calculatePublicFareOptions({
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
    coupon: {
      code: "SAVE20",
      type: "PERCENTAGE",
      value: 20,
      minAmount: 30,
    },
  });

  assert.equal(result.supportsReturnTrip, true);
  assert.equal(result.pricing.oneWayFare, 20);
  assert.equal(result.pricing.oneWayCouponDiscountAmount, 0);
  assert.equal(result.pricing.oneWayAppliedCoupon, null);
  assert.equal(result.pricing.roundTripFare, 43);
  assert.equal(result.pricing.originalRoundTripFare, 45);
  assert.equal(result.pricing.returnDiscountAmount, 2.5);
  assert.equal(result.pricing.returnCouponDiscountAmount, 0);
  assert.equal(result.pricing.returnAppliedCoupon, null);
});

test("eligible outbound fare allows a voucher to discount the full return fare", () => {
  const result = calculateFare({
    car: car({ basePrice: 0 }),
    distanceMiles: 20,
    pricePerMile: 2,
    returnDistanceMiles: 10,
    returnPricePerMile: 2,
    isReturnTrip: true,
    coupon: {
      code: "SAVE20",
      type: "PERCENTAGE",
      value: 20,
      minAmount: 40,
    },
  });

  assert.equal(result.breakdown.baseFare, 40);
  assert.equal(result.breakdown.returnBaseFare, 20);
  assert.equal(result.breakdown.couponDiscountAmount, 12);
  assert.equal(result.totalFare, 48);
  assert.equal(result.appliedCoupon, "SAVE20");
});

test("fixed voucher cannot reduce a vehicle fare below zero", () => {
  const result = calculatePublicFareOptions({
    car: car(),
    distanceMiles: 5,
    pricePerMile: 2,
    returnDistanceMiles: 5,
    returnPricePerMile: 3,
    coupon: {
      code: "FREEFARE",
      type: "FIXED",
      value: 100,
    },
  });

  assert.equal(result.pricing.oneWayFare, 0);
  assert.equal(result.pricing.originalOneWayFare, 20);
  assert.equal(result.pricing.oneWayCouponDiscountAmount, 20);
  assert.equal(result.pricing.oneWayAppliedCoupon, "FREEFARE");
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

test("accepts a pricing snapshot containing a Meet & Greet fee", () => {
  assert.equal(
    pricingSnapshotMatchesTotal({
      baseFare: 30,
      returnBaseFare: 0,
      carDiscountAmount: 0,
      couponDiscountAmount: 5,
      meetAndGreetFee: 12.5,
      totalFare: 37.5,
    }),
    true
  );
});

test("rounds the final fare down to a whole pound", () => {
  const result = calculateFare({
    car: car({ basePrice: 10 }),
    distanceMiles: 5.245,
    pricePerMile: 2,
  });

  assert.equal(result.breakdown.baseFare, 20.49);
  assert.equal(result.totalFare, 20);
});

test("rounds the final fare up to a whole pound", () => {
  const result = calculateFare({
    car: car({ basePrice: 10 }),
    distanceMiles: 5.25,
    pricePerMile: 2,
  });

  assert.equal(result.breakdown.baseFare, 20.5);
  assert.equal(result.totalFare, 21);
  assert.equal(
    pricingSnapshotMatchesTotal({
      ...result.breakdown,
      totalFare: result.totalFare,
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
