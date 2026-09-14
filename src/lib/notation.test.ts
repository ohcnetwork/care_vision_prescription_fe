import assert from "node:assert/strict";
import { test } from "node:test";

import { formatRxLine } from "./notation";
import { type LensSpecification, newLens, setPrism } from "./prescription";

function lens(values: Partial<LensSpecification> = {}): LensSpecification {
  return { ...newLens("lens", "right"), ...values };
}

test("formatRxLine gives an empty string for an empty lens", () => {
  assert.equal(formatRxLine(lens(), "lens"), "");
  assert.equal(formatRxLine(undefined, "lens"), "");
});

test("formatRxLine writes a sphere only", () => {
  assert.equal(formatRxLine(lens({ sphere: -2 }), "lens"), "-2.00");
  assert.equal(formatRxLine(lens({ sphere: 1.25 }), "lens"), "+1.25");
});

test("formatRxLine writes a sphere, a cylinder and an axis", () => {
  const value = lens({ sphere: -2, cylinder: -0.75, axis: 180 });
  assert.equal(formatRxLine(value, "lens"), "-2.00 / -0.75 x 180");
});

test("formatRxLine adds the reading addition", () => {
  const value = lens({ sphere: -2, add: 2 });
  assert.equal(formatRxLine(value, "lens"), "-2.00   Add +2.00");
});

test("formatRxLine marks a missing half of a pair", () => {
  assert.equal(
    formatRxLine(lens({ cylinder: -0.75 }), "lens"),
    "-- / -0.75 x --",
  );
});

test("formatRxLine writes the prism with the short base", () => {
  const value = setPrism(lens({ sphere: -2 }), "horizontal", {
    amount: 2,
    base: "in",
  });
  assert.equal(formatRxLine(value, "lens"), "-2.00   2 BI");
});

test("formatRxLine reads the power of a contact lens", () => {
  const value = { ...newLens("contact", "left"), power: -3.5 };
  assert.equal(formatRxLine(value, "contact"), "-3.50");
});
