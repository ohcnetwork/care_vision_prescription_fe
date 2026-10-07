import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  GroupField,
  GroupInputProps,
  GroupQuestionDefinition,
} from "../types/host";
import {
  PRESCRIPTION_DETAILS_SCHEMA,
  VISION_SCHEMA,
  groupUpdates,
  prescriptionValues,
  readGroupPrescription,
  updatePrescriptionRows,
} from "./group";
import {
  getLens,
  newLens,
  newPrescription,
  setDuration,
  setPrism,
  updateLens,
} from "./prescription";

function bindings(
  schema: readonly GroupQuestionDefinition[] = VISION_SCHEMA,
): Record<string, GroupField | null> {
  return Object.fromEntries(
    schema.map((child) => [
      child.link_id,
      {
        question: { ...child, id: child.link_id, questions: undefined },
        response: {
          question_id: child.link_id,
          link_id: `vision__${child.link_id}`,
          structured_type: null,
          values: [],
        },
        disabled: false,
        hidden: false,
        errors: [],
      },
    ]),
  );
}
function apply(
  fields: ReturnType<typeof bindings>,
  updates: ReturnType<typeof groupUpdates>,
) {
  for (const [key, patch] of Object.entries(updates)) {
    const field = fields[key];
    if (field) field.response = { ...field.response, ...patch };
  }
}
function host(): GroupInputProps {
  const props: GroupInputProps = {
    question: {
      id: "vision",
      link_id: "vision",
      text: "Vision",
      type: "group",
      repeats: true,
    },
    fields: bindings(),
    rows: [],
    disabled: false,
    onChange: () =>
      assert.fail("Repeating groups must write through row callbacks"),
    addRow: (updates = {}) => {
      const fields = bindings();
      apply(fields, updates);
      const row = {
        fields,
        onChange: (updates: ReturnType<typeof groupUpdates>) =>
          apply(fields, updates),
        remove: () => {
          props.rows = props.rows.filter((entry) => entry !== row);
        },
      };
      props.rows.push(row);
    },
  };
  return props;
}

test("FHIR lens schema uses required product/eye choices and separate prescription metadata", () => {
  const keys = VISION_SCHEMA.map(({ link_id }) => link_id);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(
    keys.every(
      (key) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !key.includes("__"),
    ),
  );
  assert.ok(!keys.includes("status") && !keys.includes("dateWritten"));
  for (const key of ["product", "eye"]) {
    const field = VISION_SCHEMA.find(({ link_id }) => link_id === key)!;
    assert.equal(field.type, "choice");
    assert.equal(field.required, true);
  }
  assert.equal(
    PRESCRIPTION_DETAILS_SCHEMA.find(({ link_id }) => link_id === "dateWritten")
      ?.type,
    "dateTime",
  );
});

test("rows round-trip zero, both eyes, contacts, prisms and distinct lens notes; edit and clear", () => {
  const props = host();
  assert.equal(readGroupPrescription(props.rows).kind, "empty");
  let prescription = newPrescription();
  prescription = updateLens(prescription, "lens", "right", (lens) =>
    setPrism(
      setPrism(
        {
          ...lens,
          sphere: 0,
          cylinder: -0.75,
          axis: 90,
          note: [{ text: "Coating" }],
        },
        "horizontal",
        { amount: 1.5, base: "out" },
      ),
      "vertical",
      { amount: 0.5, base: "up" },
    ),
  );
  prescription = updateLens(prescription, "contact", "left", (lens) =>
    setDuration(
      {
        ...lens,
        power: -2.25,
        backCurve: 8.6,
        diameter: 14.2,
        brand: "Example",
        color: "Brown",
        note: [{ text: "Contact note" }],
      },
      8,
      "h",
    ),
  );
  updatePrescriptionRows(props, prescription);
  assert.equal(props.rows.length, 2);
  assert.deepEqual(props.rows[0].fields.sphere?.response.values, [
    { type: "number", value: 0 },
  ]);
  const result = readGroupPrescription(props.rows);
  assert.equal(result.kind, "value");
  if (result.kind !== "value") return;
  assert.deepEqual(
    result.prescription.lensSpecification.map(prescriptionValues),
    prescription.lensSpecification.map(prescriptionValues),
  );
  updatePrescriptionRows(props, prescription);
  assert.equal(props.rows.length, 2);
  prescription = updateLens(prescription, "lens", "right", (lens) => ({
    ...lens,
    sphere: -1,
  }));
  updatePrescriptionRows(props, prescription);
  assert.equal(props.rows[0].fields.sphere?.response.values[0]?.value, -1);
  updatePrescriptionRows(props, {
    ...prescription,
    lensSpecification: prescription.lensSpecification.slice(1),
  });
  assert.equal(props.rows.length, 1);
  updatePrescriptionRows(props);
  assert.equal(readGroupPrescription(props.rows).kind, "empty");
});

test("locked, hidden, missing fields and parent readonly cannot change or remove rows", () => {
  for (const state of ["disabled", "hidden", "missing", "parent"] as const) {
    const props = host();
    const prescription = {
      ...newPrescription(),
      lensSpecification: [{ ...newLens("lens", "right"), sphere: 0 }],
    };
    updatePrescriptionRows(props, prescription);
    if (state === "missing") props.rows[0].fields.sphere = null;
    else if (state === "parent") props.question.read_only = true;
    else props.rows[0].fields.sphere![state] = true;
    updatePrescriptionRows(props);
    assert.equal(props.rows.length, 1);
  }
  const fields = bindings();
  fields.sphere!.hidden = true;
  apply(fields, groupUpdates(fields, { sphere: 2, eye: "unsupported" }));
  assert.deepEqual(fields.sphere!.response.values, []);
  assert.deepEqual(fields.eye!.response.values, []);
});

test("reject duplicate or invalid row identities without losing draft numbers or incomplete prisms", () => {
  const props = host();
  const prescription = {
    ...newPrescription(),
    lensSpecification: [
      setPrism({ ...newLens("lens", "right"), sphere: "-" }, "horizontal", {
        amount: 0,
      }),
    ],
  };
  updatePrescriptionRows(props, prescription);
  const result = readGroupPrescription(props.rows);
  assert.equal(result.kind, "value");
  if (result.kind === "value") {
    const lens = getLens(result.prescription, "lens", "right")!;
    assert.equal(lens.sphere, "-");
    assert.equal(lens.prism?.[0].amount, 0);
    assert.equal(lens.prism?.[0].base, undefined);
  }
  props.rows.push(props.rows[0]);
  assert.equal(readGroupPrescription(props.rows).kind, "invalid");
  props.rows.pop();
  props.rows[0].fields.eye!.response.values = [
    { type: "string", value: "both" },
  ];
  assert.equal(readGroupPrescription(props.rows).kind, "invalid");
});

test("prescription datetime and status are typed answers that can be cleared independently", () => {
  const fields = bindings(PRESCRIPTION_DETAILS_SCHEMA);
  apply(
    fields,
    groupUpdates(fields, { status: "active", dateWritten: "2026-09-27T14:30" }),
  );
  assert.equal(fields.status!.response.values[0].value, "active");
  const date = fields.dateWritten!.response.values[0].value;
  assert.ok(date instanceof Date);
  assert.equal(date.getHours(), 14);
  assert.equal(date.getMinutes(), 30);
  apply(fields, groupUpdates({ status: fields.status }, { status: undefined }));
  assert.deepEqual(fields.status!.response.values, []);
  assert.equal(fields.dateWritten!.response.values[0].value, date);
});
