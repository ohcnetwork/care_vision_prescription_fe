import type {
  QuestionValidationError,
  RegisteredGroupDefinition,
} from "../types/host";
import { STATUSES } from "./constants";
import { groupKey, readLens } from "./group";
import { getProduct, localDate } from "./prescription";
import { getLensIssues, issueMessage } from "./validate";

export const validateLensGroup: NonNullable<
  RegisteredGroupDefinition["validate"]
> = (question, responses, path) => {
  const children = new Map(
    (question.questions ?? []).map((child) => [
      child.link_id.slice(question.link_id.length + 2),
      child,
    ]),
  );
  const seen = new Set<string>();
  return (responses[question.id]?.sub_results ?? []).flatMap(
    (row, rowIndex) => {
      const answers = new Map(
        row.map((answer) => [answer.question_id, answer]),
      );
      const get = (key: string) => {
        const child = children.get(key);
        const value = child && answers.get(child.id)?.values[0]?.value;
        return value === "" ? undefined : value;
      };
      const response_path = [...path, { questionId: question.id, rowIndex }];
      const parsed = readLens(get);
      if (!parsed.success || row.some((answer) => answer.values.length > 1))
        return [
          {
            question_id: question.id,
            response_path: path,
            error: issueMessage({ field: "answer", message: "error_answer" }),
          },
        ];
      const lens = parsed.data;
      const identity = `${getProduct(lens)}.${lens.eye}`;
      const issues = getLensIssues(lens);
      if (seen.has(identity))
        issues.push({
          field: `${identity}.eye`,
          message: "error_duplicate_eye",
        });
      seen.add(identity);
      return issues.flatMap((issue): QuestionValidationError[] => {
        const key = groupKey(issue.field.split(".").slice(2).join("."));
        const child = children.get(key);
        return child
          ? [
              {
                question_id: child.id,
                response_path,
                error: issueMessage(issue),
              },
            ]
          : [];
      });
    },
  );
};

export const validatePrescriptionDetails: NonNullable<
  RegisteredGroupDefinition["validate"]
> = (question, responses, path) =>
  (question.questions ?? []).flatMap((child): QuestionValidationError[] => {
    const values = responses[child.id]?.values ?? [];
    const value = values[0]?.value;
    if (values.length === 0 || value === undefined || value === "") return [];
    const key = child.link_id.slice(question.link_id.length + 2);
    let message:
      "error_answer" | "error_date" | "error_future_date" | undefined;
    if (values.length > 1) message = "error_answer";
    else if (key === "status" && !STATUSES.some((status) => status === value))
      message = "error_answer";
    else if (key === "dateWritten") {
      if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
        message = "error_date";
      else if (localDate(value) > localDate()) message = "error_future_date";
    }
    return message
      ? [
          {
            question_id: child.id,
            response_path: path,
            error: issueMessage({ field: key, message }),
          },
        ]
      : [];
  });
