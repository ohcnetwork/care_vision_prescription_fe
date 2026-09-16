import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTranspose,
  cylinderForm,
  formatTransposed,
  getClinicalHints,
  powerCross,
  sphericalEquivalent,
  transposeLens,
} from "./optics";
import {
  type LensSpecification,
  newLens,
  newPrescription,
  updateLens,
} from "./prescription";

function lens(values: Partial<LensSpecification> = {}): LensSpecification {
  return { ...newLens("lens", "right"), ...values };
}

function pair(
  right: Partial<LensSpecification>,
  left: Partial<LensSpecification>,
) {
  let prescription = newPrescription();
  prescription = updateLens(prescription, "lens", "right", (value) => ({
    ...value,
    ...right,
  }));
  prescription = updateLens(prescription, "lens", "left", (value) => ({
    ...value,
    ...left,
  }));
  return prescription;
}

test("transposeLens moves the cylinder to the other form", () => {
  const value = lens({ sphere: -2, cylinder: -0.75, axis: 90 });
  const next = transposeLens(value);
  assert.equal(next.sphere, -2.75);
  assert.equal(next.cylinder, 0.75);
  assert.equal(next.axis, 180);
});

test("transposeLens keeps the axis in 1 to 180", () => {
  assert.equal(
    transposeLens(lens({ sphere: 0, cylinder: 1, axis: 180 })).axis,
    90,
  );
  assert.equal(
    transposeLens(lens({ sphere: 0, cylinder: 1, axis: 45 })).axis,
    135,
  );
  assert.equal(
    transposeLens(lens({ sphere: 0, cylinder: 1, axis: 135 })).axis,
    45,
  );
});

test("transposeLens twice gives the first lens", () => {
  const value = lens({ sphere: 1.25, cylinder: -2.5, axis: 10, add: 2 });
  assert.deepEqual(transposeLens(transposeLens(value)), value);
});

test("transposeLens leaves an incomplete lens unchanged", () => {
  const value = lens({ sphere: -2, cylinder: -0.75 });
  assert.equal(transposeLens(value), value);
  assert.equal(canTranspose(value), false);
  assert.equal(
    canTranspose(lens({ sphere: -2, cylinder: 0, axis: 90 })),
    false,
  );
  assert.equal(
    canTranspose(lens({ sphere: "-2.", cylinder: -1, axis: 90 })),
    false,
  );
});

test("transposeLens reads the power of a contact lens", () => {
  const value = {
    ...newLens("contact", "left"),
    power: -3,
    cylinder: -1.25,
    axis: 20,
  };
  const next = transposeLens(value);
  assert.equal(next.power, -4.25);
  assert.equal(next.cylinder, 1.25);
  assert.equal(next.axis, 110);
});

test("powerCross gives the power of both meridians", () => {
  const cross = powerCross(lens({ sphere: -2, cylinder: -0.75, axis: 90 }));
  assert.deepEqual(cross, { axis: 90, alongAxis: -2, acrossAxis: -2.75 });
  assert.equal(powerCross(lens({ sphere: -2 })), undefined);
});

test("formatTransposed writes the other form", () => {
  assert.equal(
    formatTransposed(lens({ sphere: -2, cylinder: -0.75, axis: 90 })),
    "-2.75 / +0.75 x 180",
  );
  assert.equal(formatTransposed(lens({ sphere: -2 })), "");
});

test("cylinderForm reads the sign of the cylinder", () => {
  assert.equal(cylinderForm(lens({ cylinder: -1 })), "minus");
  assert.equal(cylinderForm(lens({ cylinder: 1 })), "plus");
  assert.equal(cylinderForm(lens({ cylinder: 0 })), undefined);
  assert.equal(cylinderForm(lens()), undefined);
});

test("sphericalEquivalent adds half the cylinder", () => {
  assert.equal(sphericalEquivalent(lens({ sphere: -2, cylinder: -1 })), -2.5);
  assert.equal(sphericalEquivalent(lens({ sphere: -2 })), -2);
  assert.equal(sphericalEquivalent(lens()), undefined);
});

test("getClinicalHints stays silent for a usual pair", () => {
  const prescription = pair(
    { sphere: -2.25, cylinder: -0.75, axis: 90, add: 1.5 },
    { sphere: -1.75, cylinder: -0.5, axis: 85, add: 1.5 },
  );
  assert.deepEqual(getClinicalHints(prescription), []);
});

test("getClinicalHints reports anisometropia from the spherical equivalent", () => {
  const prescription = pair({ sphere: -1, cylinder: -1 }, { sphere: 1.5 });
  const hints = getClinicalHints(prescription);
  assert.equal(hints.length, 1);
  assert.equal(hints[0].message, "hint_anisometropia");
  assert.deepEqual(hints[0].values, { difference: "3.00" });
});

test("getClinicalHints reports a high power for each eye", () => {
  const prescription = pair({ sphere: -12 }, { sphere: -11.5 });
  const hints = getClinicalHints(prescription);
  assert.deepEqual(
    hints.map((hint) => [hint.message, hint.eye]),
    [
      ["hint_high_power", "right"],
      ["hint_high_power", "left"],
    ],
  );
});

test("getClinicalHints reports a mixed cylinder form", () => {
  const prescription = pair(
    { sphere: -1, cylinder: -0.5, axis: 90 },
    { sphere: -1, cylinder: 0.5, axis: 180 },
  );
  assert.deepEqual(
    getClinicalHints(prescription).map((hint) => hint.message),
    ["hint_mixed_cylinder"],
  );
});

test("getClinicalHints reports an Add that differs", () => {
  const prescription = pair({ sphere: -1, add: 1.5 }, { sphere: -1, add: 2 });
  assert.deepEqual(
    getClinicalHints(prescription).map((hint) => hint.message),
    ["hint_add_differs"],
  );
});

test("getClinicalHints limits the hints to one product", () => {
  const prescription = pair({ sphere: -12 }, { sphere: -9.75 });
  assert.equal(getClinicalHints(prescription, "contact").length, 0);
  assert.equal(getClinicalHints(prescription, "lens").length, 1);
});
