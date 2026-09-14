import assert from "node:assert/strict";
import { test } from "node:test";

import { VISION_PRESCRIPTION_TYPE } from "./constants";
import {
  type StoredResponse,
  extractPrescriptions,
  nextHistoryOffset,
} from "./history";
import { type VisionPrescription, newLens } from "./prescription";

const prescription: VisionPrescription = {
  schemaVersion: 1,
  status: "active",
  created: "2020-03-01T12:00:00Z",
  dateWritten: "2020-03-01",
  context: {
    patientId: "patient-1",
    encounterId: "encounter-1",
    prescriber: { id: "user-1", display: "Test prescriber" },
  },
  lensSpecification: [{ ...newLens("lens", "right"), sphere: -2.25 }],
};

const response: StoredResponse = {
  id: "response-1",
  created_date: "2020-03-01T12:01:00Z",
  encounter: "encounter-1",
  status: "completed",
  questionnaire: {
    title: "Eye assessment",
    questions: [
      {
        id: "group-1",
        type: "group",
        questions: [
          {
            id: "question-1",
            type: "structured",
            structured_type: VISION_PRESCRIPTION_TYPE,
            text: "Vision prescription",
          },
        ],
      },
    ],
  },
  responses: [
    {
      question_id: "question-1",
      values: [{ value: JSON.stringify([prescription]) }],
      note: "Test note",
    },
  ],
};

test("history decodes stored values under nested question groups", () => {
  const entries = extractPrescriptions([response], "patient-1");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].answer.kind, "value");
  assert.equal(entries[0].note, "Test note");
  assert.equal(entries[0].id, "response-1:question-1");
});

test("history skips unrelated and entered-in-error responses", () => {
  assert.deepEqual(
    extractPrescriptions(
      [{ ...response, status: "entered_in_error" }],
      "patient-1",
    ),
    [],
  );
  assert.deepEqual(
    extractPrescriptions([{ ...response, questionnaire: null }], "patient-1"),
    [],
  );
  assert.deepEqual(
    extractPrescriptions(
      [{ ...response, questionnaire: { title: "Other", questions: [] } }],
      "patient-1",
    ),
    [],
  );
});

test("history exposes corrupt data instead of an empty or partial prescription", () => {
  const corrupt = {
    ...response,
    responses: [{ question_id: "question-1", values: [{ value: "{" }] }],
  };
  assert.equal(
    extractPrescriptions([corrupt], "patient-1")[0].answer.kind,
    "invalid",
  );
  const wrongPatient = extractPrescriptions([response], "patient-2");
  assert.equal(wrongPatient[0].answer.kind, "invalid");
  const wrongEncounter = extractPrescriptions(
    [{ ...response, encounter: "encounter-2" }],
    "patient-1",
  );
  assert.equal(wrongEncounter[0].answer.kind, "invalid");
});

test("history advances by the actual page size, not an assumed limit", () => {
  assert.equal(
    nextHistoryOffset({ count: 3, results: [response], offset: 0 }),
    1,
  );
  assert.equal(
    nextHistoryOffset({ count: 3, results: [response], offset: 2 }),
    undefined,
  );
  assert.equal(
    nextHistoryOffset({ count: 0, results: [], offset: 0 }),
    undefined,
  );
});
