import i18next from "i18next";

import en from "../../public/locale/en.json";
import type { QuestionValidationError } from "../types/host";
import { DURATION_LABELS, PLUGIN_SLUG } from "./constants";
import {
  type Eye,
  type LensSpecification,
  type NumericField,
  type Product,
  type VisionPrescription,
  getProduct,
  isValidDate,
  localDate,
  prescriptionSchema,
  prismPlane,
} from "./prescription";

export type MessageKey = keyof typeof en;

export interface PrescriptionIssue {
  field: string;
  message: MessageKey;
  product?: Product;
  eye?: Eye;
}

const NUMERIC_FIELDS: NumericField[] = [
  "sphere",
  "cylinder",
  "axis",
  "add",
  "power",
  "backCurve",
  "diameter",
];
const DIOPTRE_FIELDS = new Set<NumericField>([
  "sphere",
  "cylinder",
  "add",
  "power",
]);

export function fieldKey(product: Product, eye: Eye, field: string): string {
  return `${product}.${eye}.${field}`;
}

export function getPrescriptionIssues(
  prescription: VisionPrescription,
  today = localDate(),
): PrescriptionIssue[] {
  const issues: PrescriptionIssue[] = [];
  const add = (
    field: string,
    message: MessageKey,
    product?: Product,
    eye?: Eye,
  ) => issues.push({ field, message, product, eye });

  if (!isValidDate(prescription.dateWritten)) {
    add("dateWritten", "error_date");
  } else if (prescription.dateWritten > today) {
    add("dateWritten", "error_future_date");
  }
  if (!Number.isFinite(Date.parse(prescription.created))) {
    add("created", "error_created");
  }
  if (!prescription.context?.prescriber) {
    add("context", "error_prescriber");
  }
  if (!prescription.context?.patientId || !prescription.context.encounterId) {
    add("context", "error_context");
  }
  if (prescription.lensSpecification.length === 0) {
    add("lensSpecification", "error_lens_required");
  }

  const seen = new Set<string>();
  for (const lens of prescription.lensSpecification) {
    const product = getProduct(lens);
    const eye = lens.eye;
    const lensKey = `${product}.${eye}`;
    if (seen.has(lensKey))
      add(fieldKey(product, eye, "eye"), "error_duplicate_eye", product, eye);
    seen.add(lensKey);

    issues.push(...getLensIssues(lens));
  }
  return issues;
}

/** Optical rules shared by the group callback and legacy prescription validation. */
export function getLensIssues(lens: LensSpecification): PrescriptionIssue[] {
  const issues: PrescriptionIssue[] = [];
  const product = getProduct(lens);
  const eye = lens.eye;
  const error = (field: string, message: MessageKey) =>
    issues.push({
      field: fieldKey(product, eye, field),
      message,
      product,
      eye,
    });
  const primary = product === "lens" ? "sphere" : "power";
  if (lens[primary] === undefined) {
    error(
      primary,
      product === "lens" ? "error_sphere_required" : "error_power_required",
    );
  }
  for (const field of NUMERIC_FIELDS) {
    const value = lens[field];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      error(field, "error_number");
      continue;
    }
    if (
      DIOPTRE_FIELDS.has(field) &&
      (Math.abs(value) > Number.MAX_SAFE_INTEGER / 4 ||
        Math.abs(value * 4 - Math.round(value * 4)) > 1e-8)
    ) {
      error(field, "error_quarter");
    }
    if (
      field === "axis" &&
      (!Number.isInteger(value) || value < 0 || value > 180)
    ) {
      error(field, "error_axis");
    }
    if ((field === "backCurve" || field === "diameter") && value <= 0) {
      error(field, "error_positive");
    }
    if (
      (product === "lens" &&
        ["power", "backCurve", "diameter"].includes(field)) ||
      (product === "contact" && field === "sphere")
    ) {
      error(field, "error_product_field");
    }
  }

  if (lens.cylinder !== undefined && lens.axis === undefined) {
    error("axis", "error_axis_required");
  }
  if (lens.axis !== undefined && lens.cylinder === undefined) {
    error("cylinder", "error_cylinder_required");
  }

  const planes = new Set<string>();
  for (const prism of lens.prism ?? []) {
    const plane = prism.base
      ? prismPlane(prism.base)
      : (prism.draftPlane ?? "horizontal");
    if (typeof prism.amount !== "number" || !Number.isFinite(prism.amount)) {
      error(`prism.${plane}.amount`, "error_prism_amount");
    } else if (prism.amount < 0) {
      error(`prism.${plane}.amount`, "error_nonnegative");
    }
    if (!prism.base) {
      error(`prism.${plane}.base`, "error_prism_base");
    } else {
      if (planes.has(plane))
        error(`prism.${plane}.base`, "error_prism_duplicate");
      planes.add(plane);
      if (prism.draftPlane !== undefined) {
        error(`prism.${plane}.base`, "error_prism_draft");
      }
    }
  }

  if (lens.duration !== undefined) {
    const { value, code, unit } = lens.duration;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      error("duration", "error_duration");
    }
    if (!code || unit !== DURATION_LABELS[code]) {
      error("duration", "error_duration_unit");
    }
  }
  if (
    product === "lens" &&
    (lens.duration !== undefined ||
      lens.color !== undefined ||
      lens.brand !== undefined)
  ) {
    error("product", "error_product_field");
  }
  return issues;
}

// Validation text must never degrade to "undefined" in front of a clinician,
// so the bundled English string stands in whenever i18next returns no string
// (an instance the host has not initialized yet returns undefined).
function translate(key: MessageKey): string {
  const fallback = en[key];
  if (!i18next.isInitialized) return fallback;
  const message = i18next.t(key, { ns: PLUGIN_SLUG, defaultValue: fallback });
  return typeof message === "string" && message !== "" ? message : fallback;
}

export function issueMessage(issue: PrescriptionIssue): string {
  const message = translate(issue.message);
  if (!issue.product || !issue.eye) return message;
  return `${translate(issue.product)} / ${translate(issue.eye)}: ${message}`;
}

export function validateVisionPrescription(
  data: unknown[],
  questionId: string,
  required: boolean,
): QuestionValidationError[] {
  const error = (key: MessageKey): QuestionValidationError[] => [
    {
      question_id: questionId,
      error: issueMessage({ field: "answer", message: key }),
    },
  ];
  if (data.length === 0) return required ? error("error_lens_required") : [];
  if (data.length !== 1) return error("error_answer");
  const parsed = prescriptionSchema.safeParse(data[0]);
  if (!parsed.success) return error("error_answer");
  return getPrescriptionIssues(parsed.data).map((issue) => ({
    question_id: questionId,
    error: issueMessage(issue),
  }));
}
