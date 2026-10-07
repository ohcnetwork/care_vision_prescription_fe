import assert from "node:assert/strict";
import { test } from "node:test";

import manifest from "../manifest";
import type { Question, QuestionnaireResponse } from "../types/host";

function form(index: 0 | 1, values: Record<string, unknown>[]) {
  const definition = manifest.registeredQuestionGroups[index];
  const question: Question = {
    id: "group",
    link_id: "group",
    text: "Vision",
    type: "group",
    repeats: index === 1,
    questions: definition.schema.map((child) => ({
      ...child,
      id: child.link_id,
      link_id: `group__${child.link_id}`,
      questions: undefined,
    })),
  };
  const rows = values.map((value) =>
    question.questions!.map((child): QuestionnaireResponse => ({
      question_id: child.id,
      link_id: child.link_id,
      structured_type: null,
      values:
        value[child.id] === undefined
          ? []
          : [{ type: child.type, value: value[child.id] }],
    })),
  );
  const responses: Record<string, QuestionnaireResponse> =
    index === 1
      ? {
          group: {
            question_id: "group",
            link_id: "group",
            structured_type: null,
            values: [],
            sub_results: rows,
          },
        }
      : Object.fromEntries(
          (rows[0] ?? []).map((row) => [row.question_id, row]),
        );
  const path = [{ questionId: "outer", rowIndex: 2 }];
  return {
    question,
    responses,
    path,
    validate: () => definition.validate(question, responses, path),
  };
}

const lens = { product: "lens", eye: "right", sphere: 0 };

test("registered lens callback accepts empty groups and zero without envelope metadata", () => {
  assert.deepEqual(form(1, []).validate(), []);
  const fixture = form(1, [
    lens,
    {
      product: "contact",
      eye: "left",
      power: -2,
      backCurve: 8.6,
      diameter: 14.2,
      duration: 8,
      durationCode: "h",
    },
  ]);
  const before = structuredClone(fixture.responses);
  assert.deepEqual(fixture.validate(), []);
  assert.deepEqual(fixture.responses, before);
});

test("registered lens callback enforces optical rules and targets the saved child row", () => {
  for (const [values, field] of [
    [{ ...lens, sphere: "-" }, "sphere"],
    [{ ...lens, sphere: 0.1 }, "sphere"],
    [{ ...lens, cylinder: 0 }, "axis"],
    [{ ...lens, axis: 90 }, "cylinder"],
    [{ ...lens, cylinder: -1, axis: 181 }, "axis"],
    [{ ...lens, prism_horizontal_amount: 1 }, "prism_horizontal_base"],
    [{ ...lens, prism_vertical_base: "up" }, "prism_vertical_amount"],
    [
      { ...lens, prism_horizontal_amount: -1, prism_horizontal_base: "in" },
      "prism_horizontal_amount",
    ],
    [{ product: "contact", eye: "right", power: 0, backCurve: 0 }, "backCurve"],
    [
      {
        product: "contact",
        eye: "right",
        power: 0,
        duration: -1,
        durationCode: "h",
      },
      "duration",
    ],
    [{ product: "contact", eye: "right", power: 0, duration: 8 }, "duration"],
    [{ ...lens, power: 1 }, "power"],
    [{ product: "lens", eye: "right", note: "Incomplete" }, "sphere"],
  ] as const) {
    const fixture = form(1, [values]);
    const errors = fixture.validate();
    assert.ok(
      errors.some((error) => error.question_id === field),
      JSON.stringify({ values, errors }),
    );
    assert.ok(errors.every((error) => error.error));
    assert.deepEqual(errors[0].response_path, [
      ...fixture.path,
      { questionId: "group", rowIndex: 0 },
    ]);
  }
});

test("duplicate lens identities and malformed rows block submission", () => {
  const duplicate = form(1, [lens, lens]);
  assert.deepEqual(
    duplicate
      .validate()
      .map((error) => [
        error.question_id,
        error.response_path?.at(-1)?.rowIndex,
      ]),
    [["eye", 1]],
  );
  assert.ok(form(1, [{ ...lens, eye: "unknown" }]).validate().length);
  const multiple = form(1, [lens]);
  multiple.responses.group.sub_results![0][0].values = [
    { type: "string", value: "a" },
    { type: "string", value: "b" },
  ];
  assert.ok(multiple.validate().length);
});

test("older lens schemas do not get errors targeting absent optional children", () => {
  const fixture = form(1, [{ ...lens, cylinder: -1 }]);
  fixture.question.questions = fixture.question.questions!.filter(
    (child) => child.id !== "axis",
  );
  assert.deepEqual(fixture.validate(), []);
});

test("registered details callback validates status and dates without requiring lens metadata", () => {
  assert.deepEqual(form(0, [{}]).validate(), []); // CARE checks required answers.
  assert.deepEqual(
    form(0, [
      { status: "active", dateWritten: new Date("2020-01-01T10:00:00Z") },
    ]).validate(),
    [],
  );
  for (const values of [
    { status: "unknown" },
    { dateWritten: new Date("invalid") },
    { dateWritten: new Date("2999-01-01T10:00:00Z") },
  ]) {
    const fixture = form(0, [values]);
    const errors = fixture.validate();
    assert.equal(errors.length, 1);
    assert.equal(errors[0].question_id, Object.keys(values)[0]);
    assert.deepEqual(errors[0].response_path, fixture.path);
  }
});
