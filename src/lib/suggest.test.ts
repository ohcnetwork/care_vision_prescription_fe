import assert from "node:assert/strict";
import { test } from "node:test";

import { newLens } from "./prescription";
import { validPrescription } from "./prescription.test";
import {
  type SuggestKind,
  kindForField,
  suggestValues,
  suggestionLabel,
} from "./suggest";
import { getPrescriptionIssues } from "./validate";

/** Issues raised against one field of the first lens. */
function issuesFor(
  prescription: ReturnType<typeof validPrescription>,
  field: string,
): string[] {
  return getPrescriptionIssues(prescription, "2030-01-01")
    .filter((issue) => issue.field.endsWith(`.${field}`))
    .map((issue) => issue.message);
}

/** Typed text that exercises the empty state, whole numbers and part decimals. */
const INPUTS = ["", "0", "1", "2", "2.", "2.2", "9", "14", "-1", "+3", "180"];

test("every generated spectacle value passes validation", () => {
  for (const input of INPUTS) {
    for (const value of suggestValues("dioptre", input)) {
      const prescription = validPrescription({ sphere: value });
      assert.deepEqual(
        issuesFor(prescription, "sphere"),
        [],
        `sphere ${value} from input "${input}" must be valid`,
      );
    }
  }
});

test("every generated add value passes validation", () => {
  for (const input of INPUTS) {
    for (const value of suggestValues("add", input)) {
      const prescription = validPrescription({ sphere: 0, add: value });
      assert.deepEqual(issuesFor(prescription, "add"), [], `add ${value}`);
    }
  }
});

test("every generated axis value passes validation", () => {
  for (const input of INPUTS) {
    for (const value of suggestValues("axis", input)) {
      const prescription = validPrescription({
        sphere: 0,
        cylinder: -1,
        axis: value,
      });
      assert.deepEqual(issuesFor(prescription, "axis"), [], `axis ${value}`);
    }
  }
});

test("every generated contact lens value passes validation", () => {
  for (const field of ["backCurve", "diameter"] as const) {
    for (const input of INPUTS) {
      for (const value of suggestValues(kindForField(field), input)) {
        const prescription = validPrescription();
        prescription.lensSpecification = [
          { ...newLens("contact", "right"), power: 0, [field]: value },
        ];
        assert.deepEqual(
          issuesFor(prescription, field),
          [],
          `${field} ${value} from input "${input}"`,
        );
      }
    }
  }
});

test("every generated prism amount passes validation", () => {
  for (const input of INPUTS) {
    for (const value of suggestValues("prism", input)) {
      const prescription = validPrescription({
        sphere: 0,
        prism: [{ amount: value, base: "up" }],
      });
      assert.deepEqual(
        issuesFor(prescription, "amount"),
        [],
        `prism ${value} from input "${input}"`,
      );
    }
  }
});

test("typed digits match the magnitude of the suggestion", () => {
  const values = suggestValues("dioptre", "2");
  assert.ok(values.length > 0);
  for (const value of values) {
    assert.ok(
      Math.abs(value).toFixed(2).startsWith("2"),
      `${value} must start with 2`,
    );
  }
  assert.ok(values.includes(2));
  assert.ok(values.includes(-2));
  assert.ok(values.includes(2.25));
});

test("a typed sign narrows the list to one polarity", () => {
  assert.ok(suggestValues("dioptre", "-2").every((value) => value <= 0));
  assert.ok(suggestValues("dioptre", "+2").every((value) => value >= 0));
});

test("a lone sign still offers values of that polarity", () => {
  const values = suggestValues("dioptre", "-");
  assert.ok(values.length > 0);
  assert.ok(values.every((value) => value <= 0));
});

test("a part typed decimal keeps the whole number matches", () => {
  assert.deepEqual(
    suggestValues("dioptre", "2."),
    suggestValues("dioptre", "2"),
  );
  assert.ok(suggestValues("dioptre", "2.2").includes(2.25));
});

test("an empty field shows the common values first", () => {
  assert.deepEqual(suggestValues("axis", "").slice(0, 3), [0, 10, 20]);
  assert.deepEqual(suggestValues("dioptre", "").slice(0, 3), [0, 0.25, -0.25]);
});

test("text that is not a number gives no suggestions", () => {
  for (const kind of ["dioptre", "axis", "prism"] as SuggestKind[]) {
    assert.deepEqual(suggestValues(kind, "abc"), []);
    assert.deepEqual(suggestValues(kind, "1e2"), []);
  }
});

test("the axis list never leaves the range validation allows", () => {
  for (const input of ["", "1", "18", "180", "9"]) {
    for (const value of suggestValues("axis", input)) {
      assert.ok(
        Number.isInteger(value) && value >= 0 && value <= 180,
        `${value}`,
      );
    }
  }
});

test("the label carries the sign only where the value has a polarity", () => {
  assert.equal(suggestionLabel(2, "dioptre"), "+2.00");
  assert.equal(suggestionLabel(-2.25, "dioptre"), "-2.25");
  assert.equal(suggestionLabel(90, "axis"), "90");
  assert.equal(suggestionLabel(8.6, "backCurve"), "8.6");
});

test("a selected label reads back as the same number", () => {
  for (const kind of [
    "dioptre",
    "axis",
    "prism",
    "backCurve",
  ] as SuggestKind[]) {
    for (const value of suggestValues(kind, "")) {
      assert.equal(Number(suggestionLabel(value, kind)), value);
    }
  }
});
