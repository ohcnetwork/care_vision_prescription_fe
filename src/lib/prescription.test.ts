import assert from "node:assert/strict";
import { test } from "node:test";

import { PRODUCT_SYSTEM, UCUM_SYSTEM } from "./constants";
import {
  type LensSpecification,
  type VisionPrescription,
  contextMatches,
  formatDate,
  formatNumeric,
  getLens,
  getPrism,
  isValidDate,
  newLens,
  parseNumericInput,
  readPrescription,
  setDuration,
  setLensField,
  setPrism,
  updateLens,
} from "./prescription";
import { getPrescriptionIssues, validateVisionPrescription } from "./validate";

export function validPrescription(
  lens: Partial<LensSpecification> = {},
): VisionPrescription {
  return {
    schemaVersion: 1,
    status: "active",
    created: "2020-03-01T12:00:00Z",
    dateWritten: "2020-03-01",
    context: {
      patientId: "patient-1",
      encounterId: "encounter-1",
      prescriber: { id: "user-1", display: "Test prescriber" },
    },
    lensSpecification: [{ ...newLens("lens", "right"), sphere: 0, ...lens }],
  };
}

test("zero is a valid plano prescription and does not create a left-eye value", () => {
  const value = validPrescription();
  assert.deepEqual(getPrescriptionIssues(value), []);
  assert.equal(getLens(value, "lens", "left"), undefined);
  assert.equal(formatNumeric(0, true), "+0.00");
  assert.equal(formatNumeric(-0, true), "+0.00");
  assert.equal(formatNumeric(undefined, true), "-");
});

test("the host value is an array with exactly 1 prescription", () => {
  const value = validPrescription();
  assert.equal(readPrescription([value]).kind, "value");
  for (const bad of [value, [value, value], [{}], "[]", null]) {
    assert.equal(readPrescription(bad).kind, "invalid");
  }
  assert.equal(readPrescription([]).kind, "empty");
  assert.equal(readPrescription(undefined).kind, "empty");
});

test("unknown versions and fields do not become blank answers", () => {
  const value = validPrescription();
  assert.equal(
    readPrescription([{ ...value, schemaVersion: 2 }]).kind,
    "invalid",
  );
  assert.equal(readPrescription([{ ...value, unknown: true }]).kind, "invalid");
});

test("invalid numeric text stays in the draft and blocks submit", () => {
  for (const raw of ["-", "+", ".", "1e2", "  ", "2.25 D", "Infinity"]) {
    assert.equal(parseNumericInput(raw), raw);
    const value = validPrescription({ sphere: raw });
    assert.equal(readPrescription([value]).kind, "value");
    assert.ok(validateVisionPrescription([value], "vision", true).length > 0);
  }
  assert.equal(parseNumericInput(""), undefined);
  assert.equal(parseNumericInput("-0.75"), -0.75);
  assert.equal(parseNumericInput("+1.50"), 1.5);
  assert.equal(parseNumericInput(".25"), 0.25);
});

test("format does not round away an invalid value", () => {
  assert.equal(formatNumeric(-2.25, true), "-2.25");
  assert.equal(formatNumeric(1.333, true), "+1.333");
  assert.equal(formatNumeric("-"), "-");
});

test("all optical powers use steps of 0.25 D", () => {
  for (const field of ["sphere", "cylinder", "add"] as const) {
    const value = validPrescription({
      [field]: 1.3,
      ...(field === "cylinder" ? { axis: 90 } : {}),
    });
    assert.ok(
      getPrescriptionIssues(value).some(
        (issue) =>
          issue.field.endsWith(field) && issue.message === "error_quarter",
      ),
    );
  }
  const contact = validPrescription({
    product: { coding: [{ system: PRODUCT_SYSTEM, code: "contact" }] },
    sphere: undefined,
    power: -1.3,
  });
  assert.ok(
    getPrescriptionIssues(contact).some(
      (issue) => issue.message === "error_quarter",
    ),
  );
});

test("a cylinder requires an axis, including a zero cylinder", () => {
  for (const cylinder of [-0.5, 0, 0.5]) {
    assert.ok(
      getPrescriptionIssues(validPrescription({ cylinder })).some(
        (issue) => issue.message === "error_axis_required",
      ),
    );
  }
});

test("an axis requires a cylinder and a whole number from 0 to 180", () => {
  assert.ok(
    getPrescriptionIssues(validPrescription({ axis: 90 })).some(
      (issue) => issue.message === "error_cylinder_required",
    ),
  );
  for (const axis of [-1, 181, 90.5]) {
    assert.ok(
      getPrescriptionIssues(validPrescription({ axis, cylinder: -0.5 })).some(
        (issue) => issue.message === "error_axis",
      ),
    );
  }
  for (const axis of [0, 1, 90, 180]) {
    assert.deepEqual(
      getPrescriptionIssues(validPrescription({ axis, cylinder: -0.5 })),
      [],
    );
  }
});

test("a partial lens cannot count as a prescription", () => {
  assert.ok(
    getPrescriptionIssues(
      validPrescription({ sphere: undefined, add: 1 }),
    ).some((issue) => issue.message === "error_sphere_required"),
  );
  const contact = validPrescription({
    product: { coding: [{ system: PRODUCT_SYSTEM, code: "contact" }] },
    sphere: undefined,
    color: "Brown",
  });
  assert.ok(
    getPrescriptionIssues(contact).some(
      (issue) => issue.message === "error_power_required",
    ),
  );
});

test("prism entry never supplies a base without a user choice", () => {
  const partial = setPrism(newLens("lens", "right"), "vertical", {
    amount: 0.5,
  });
  assert.equal(getPrism(partial, "vertical")?.base, undefined);
  assert.equal(getPrism(partial, "vertical")?.draftPlane, "vertical");
  assert.ok(
    getPrescriptionIssues(validPrescription(partial)).some(
      (issue) => issue.message === "error_prism_base",
    ),
  );
  const complete = setPrism(partial, "vertical", { base: "down" });
  assert.equal(getPrism(complete, "vertical")?.amount, 0.5);
  assert.equal(getPrism(complete, "vertical")?.draftPlane, undefined);
  assert.deepEqual(getPrescriptionIssues(validPrescription(complete)), []);
});

test("both prism axes survive changes to either axis", () => {
  const horizontal = setPrism(newLens("lens", "right"), "horizontal", {
    amount: 1,
    base: "out",
  });
  const both = setPrism(horizontal, "vertical", { amount: 0.5, base: "up" });
  const changed = setPrism(both, "horizontal", { amount: 2 });
  assert.equal(getPrism(changed, "vertical")?.amount, 0.5);
  assert.equal(getPrism(changed, "horizontal")?.base, "out");
  assert.equal(getPrism(changed, "horizontal")?.amount, 2);
  const cleared = setPrism(changed, "horizontal", {
    amount: undefined,
    base: undefined,
  });
  assert.equal(cleared.prism?.length, 1);
  assert.equal(getPrism(cleared, "horizontal"), undefined);
});

test("a base requires an amount, and prism amounts cannot be negative", () => {
  assert.ok(
    getPrescriptionIssues(validPrescription({ prism: [{ base: "in" }] })).some(
      (issue) => issue.message === "error_prism_amount",
    ),
  );
  assert.ok(
    getPrescriptionIssues(
      validPrescription({ prism: [{ amount: -1, base: "in" }] }),
    ).some((issue) => issue.message === "error_nonnegative"),
  );
  assert.deepEqual(
    getPrescriptionIssues(
      validPrescription({ prism: [{ amount: 0, base: "in" }] }),
    ),
    [],
  );
});

test("duplicate prism axes and duplicate lens rows block submit", () => {
  const value = validPrescription({
    prism: [
      { amount: 1, base: "in" },
      { amount: 1, base: "out" },
    ],
  });
  assert.ok(
    getPrescriptionIssues(value).some(
      (issue) => issue.message === "error_prism_duplicate",
    ),
  );
  value.lensSpecification.push({ ...value.lensSpecification[0] });
  assert.equal(readPrescription([value]).kind, "invalid");
  assert.ok(validateVisionPrescription([value], "vision", false).length > 0);
});

test("lens updates preserve the other eye and the other product", () => {
  let value = validPrescription();
  value = updateLens(value, "contact", "left", (lens) =>
    setLensField(lens, "power", -2),
  );
  value = updateLens(value, "lens", "left", (lens) =>
    setLensField(lens, "sphere", 1.5),
  );
  value = updateLens(value, "lens", "right", (lens) =>
    setLensField(lens, "sphere", -0.5),
  );
  assert.deepEqual(
    value.lensSpecification.map(
      (lens) => `${lens.product.coding[0].code}.${lens.eye}`,
    ),
    ["lens.right", "lens.left", "contact.left"],
  );
  assert.equal(getLens(value, "contact", "left")?.power, -2);
  assert.equal(getLens(value, "lens", "left")?.sphere, 1.5);
  value = updateLens(value, "lens", "right", (lens) =>
    setLensField(lens, "sphere", undefined),
  );
  assert.equal(getLens(value, "lens", "right"), undefined);
  assert.equal(value.lensSpecification.length, 2);
});

test("contact fit values and wear duration must be positive", () => {
  for (const field of ["backCurve", "diameter"] as const) {
    const value = validPrescription({
      product: { coding: [{ system: PRODUCT_SYSTEM, code: "contact" }] },
      sphere: undefined,
      power: 0,
      [field]: 0,
    });
    assert.ok(
      getPrescriptionIssues(value).some(
        (issue) =>
          issue.field.endsWith(field) && issue.message === "error_positive",
      ),
    );
  }
  const value = validPrescription({
    product: { coding: [{ system: PRODUCT_SYSTEM, code: "contact" }] },
    sphere: undefined,
    power: 0,
    duration: { value: 0, code: "h", unit: "hours", system: UCUM_SYSTEM },
  });
  assert.ok(
    getPrescriptionIssues(value).some(
      (issue) => issue.message === "error_duration",
    ),
  );
});

test("duration entry permits the unit first and requires both parts", () => {
  const lens = setDuration(newLens("contact", "right"), undefined, "wk");
  assert.equal(lens.duration?.code, "wk");
  const complete = setDuration(lens, 2, lens.duration?.code);
  assert.deepEqual(complete.duration, {
    value: 2,
    code: "wk",
    unit: "weeks",
    system: UCUM_SYSTEM,
  });
  assert.equal(setDuration(complete, undefined, undefined).duration, undefined);
});

test("calendar dates reject invalid days and future dates", () => {
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2025-02-29"), false);
  assert.equal(isValidDate("2026-04-31"), false);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(isValidDate("2026-09-1"), false);
  assert.equal(formatDate("2026-09-12", "en-GB"), "12 Sept 2026");
  const value = { ...validPrescription(), dateWritten: "2026-09-13" };
  assert.ok(
    getPrescriptionIssues(value, "2026-09-12").some(
      (issue) => issue.message === "error_future_date",
    ),
  );
});

test("the draft retains its author and rejects another encounter context", () => {
  const value = validPrescription();
  const roundTrip = readPrescription(JSON.parse(JSON.stringify([value])));
  assert.equal(roundTrip.kind, "value");
  if (roundTrip.kind !== "value") return;
  assert.deepEqual(roundTrip.prescription.context, value.context);
  assert.equal(contextMatches(value, "patient-1", "encounter-1"), true);
  assert.equal(contextMatches(value, "patient-2", "encounter-1"), false);
  assert.equal(contextMatches(value, "patient-1", "encounter-2"), false);
});

test("an empty optional question stays empty; an incomplete answer still fails", () => {
  assert.deepEqual(validateVisionPrescription([], "vision", false), []);
  assert.equal(validateVisionPrescription([], "vision", true).length, 1);
  const value = { ...validPrescription(), lensSpecification: [] };
  assert.ok(validateVisionPrescription([value], "vision", false).length > 0);
  assert.ok(
    validateVisionPrescription(
      [validPrescription({ sphere: "1.25" })],
      "vision",
      false,
    ).length > 0,
  );
});

test("the host receives question-specific error text", () => {
  const errors = validateVisionPrescription(
    [validPrescription({ cylinder: -1 })],
    "question-7",
    false,
  );
  assert.ok(errors.length > 0);
  assert.ok(
    errors.every(
      (error) =>
        error.question_id === "question-7" &&
        typeof error.error === "string" &&
        error.error.length > 0,
    ),
  );
  assert.match(errors[0].error ?? "", /axis/);
});
