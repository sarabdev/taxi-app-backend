import test from "node:test";
import assert from "node:assert/strict";
import {
  selectNearestAirportCode,
  supportedAirportCodeFromPlace,
} from "../src/modules/pricing/distance.service.js";

test("selects Edinburgh when it is nearer", () => {
  assert.equal(selectNearestAirportCode({ EDI: 4.2, GLA: 42 }), "EDI");
});

test("selects Glasgow when it is nearer", () => {
  assert.equal(selectNearestAirportCode({ EDI: 51, GLA: 3.5 }), "GLA");
});

test("rejects an incomplete airport comparison", () => {
  assert.throws(
    () => selectNearestAirportCode({ EDI: 4.2 }),
    /Unable to determine the nearest airport/
  );
});

test("recognizes supported airport pickup places", () => {
  assert.equal(
    supportedAirportCodeFromPlace({
      name: "Edinburgh Airport",
      types: ["airport", "point_of_interest"],
    }),
    "EDI"
  );
  assert.equal(
    supportedAirportCodeFromPlace({
      name: "Glasgow Airport",
      types: ["airport", "establishment"],
    }),
    "GLA"
  );
});

test("does not charge nearby addresses or unsupported airports", () => {
  assert.equal(
    supportedAirportCodeFromPlace({
      name: "Edinburgh Airport Hotel",
      types: ["lodging"],
    }),
    null
  );
  assert.equal(
    supportedAirportCodeFromPlace({ name: "Aberdeen Airport", types: ["airport"] }),
    null
  );
});
