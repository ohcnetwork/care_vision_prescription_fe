import { z } from "zod";

import { getCareJson } from "./careApi";
import { VISION_PRESCRIPTION_TYPE } from "./constants";
import { type PrescriptionRead, readPrescription } from "./prescription";

interface StoredQuestion {
  id: string;
  text?: string;
  type?: string;
  structured_type?: string | null;
  questions?: StoredQuestion[];
}

const storedQuestionSchema: z.ZodType<StoredQuestion> = z.object({
  id: z.string(),
  text: z.string().optional(),
  type: z.string().optional(),
  structured_type: z.string().nullable().optional(),
  questions: z.lazy(() => storedQuestionSchema.array()).optional(),
});

export const historyPageSchema = z.object({
  count: z.number().int().nonnegative(),
  results: z.array(
    z.object({
      id: z.string(),
      created_date: z.string(),
      encounter: z.string().nullable(),
      status: z.enum(["completed", "entered_in_error"]),
      questionnaire: z
        .object({
          title: z.string(),
          questions: z.array(storedQuestionSchema),
        })
        .nullable()
        .optional(),
      responses: z.array(
        z.object({
          question_id: z.string(),
          values: z.array(z.object({ value: z.unknown().optional() })),
          note: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
});

export type HistoryPage = z.infer<typeof historyPageSchema> & {
  offset: number;
};
export type StoredResponse = z.infer<
  typeof historyPageSchema
>["results"][number];

export interface PrescriptionHistoryEntry {
  id: string;
  title: string;
  createdDate: string;
  encounterId: string | null;
  answer: PrescriptionRead;
  note?: string;
}

function visionQuestions(questions: StoredQuestion[]): StoredQuestion[] {
  return questions.flatMap((question) =>
    question.type === "group"
      ? visionQuestions(question.questions ?? [])
      : question.type === "structured" &&
          question.structured_type === VISION_PRESCRIPTION_TYPE
        ? [question]
        : [],
  );
}

function readStoredAnswer(value: unknown): PrescriptionRead {
  if (typeof value !== "string") return readPrescription(value);
  try {
    return readPrescription(JSON.parse(value));
  } catch (error) {
    if (error instanceof SyntaxError) return { kind: "invalid" };
    throw error;
  }
}

export function extractPrescriptions(
  responses: StoredResponse[],
  patientId: string,
): PrescriptionHistoryEntry[] {
  return responses.flatMap((response) => {
    const questionnaire = response.questionnaire;
    if (response.status !== "completed" || !questionnaire) return [];
    return visionQuestions(questionnaire.questions).flatMap((question) => {
      const stored = response.responses.find(
        (item) => item.question_id === question.id,
      );
      if (!stored || stored.values.length === 0) return [];
      const answer =
        stored.values.length === 1
          ? readStoredAnswer(stored.values[0].value)
          : { kind: "invalid" as const };
      if (answer.kind === "empty") return [];
      const wrongContext =
        answer.kind === "value" &&
        (answer.prescription.context?.patientId !== patientId ||
          answer.prescription.context?.encounterId !== response.encounter);
      return [
        {
          id: `${response.id}:${question.id}`,
          title: question.text ?? questionnaire.title,
          createdDate: response.created_date,
          encounterId: response.encounter,
          answer: wrongContext ? { kind: "invalid" as const } : answer,
          note: stored.note ?? undefined,
        },
      ];
    });
  });
}

export function nextHistoryOffset(page: HistoryPage): number | undefined {
  const next = page.offset + page.results.length;
  return page.results.length > 0 && next < page.count ? next : undefined;
}

export async function fetchHistoryPage(
  patientId: string,
  offset: number,
  signal: AbortSignal,
): Promise<HistoryPage> {
  const data = await getCareJson(
    `/api/v1/patient/${encodeURIComponent(patientId)}/questionnaire_response/`,
    {
      limit: "20",
      offset: String(offset),
      status: "completed",
      only_unstructured: "true",
    },
    signal,
  );
  const parsed = historyPageSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Care returned a response history with an invalid format.");
  }
  if (parsed.data.results.length === 0 && offset < parsed.data.count) {
    throw new Error(
      "Care returned an empty page before the end of the response history.",
    );
  }
  return { ...parsed.data, offset };
}
