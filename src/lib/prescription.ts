import { z } from "zod";

import {
  DURATION_LABELS,
  DURATION_UNITS,
  EYES,
  PRISM_BASES,
  PRODUCTS,
  PRODUCT_SYSTEM,
  STATUSES,
  UCUM_SYSTEM,
} from "./constants";

export type Product = (typeof PRODUCTS)[number];
export type Eye = (typeof EYES)[number];
export type PrismBase = (typeof PRISM_BASES)[number];
export type PrismPlane = "horizontal" | "vertical";
export type DurationUnit = (typeof DURATION_UNITS)[number];
export type NumericValue = number | string;
export type NumericField =
  "sphere" | "cylinder" | "axis" | "add" | "power" | "backCurve" | "diameter";

const numericDraft = z.union([z.number(), z.string()]);
const prismSchema = z.strictObject({
  amount: numericDraft.optional(),
  base: z.enum(PRISM_BASES).optional(),
  draftPlane: z.enum(["horizontal", "vertical"]).optional(),
});
const durationSchema = z.strictObject({
  value: numericDraft.optional(),
  system: z.literal(UCUM_SYSTEM),
  code: z.enum(DURATION_UNITS).optional(),
  unit: z.string().optional(),
});

export const prescriberSchema = z.strictObject({
  id: z.string().min(1),
  display: z.string().min(1),
  qualification: z.string().optional(),
  registration: z.string().optional(),
});

export const prescriptionContextSchema = z.strictObject({
  patientId: z.string().min(1),
  encounterId: z.string().min(1),
  facilityId: z.string().min(1).optional(),
  prescriber: prescriberSchema.optional(),
});

export const lensSchema = z.strictObject({
  product: z.strictObject({
    coding: z.tuple([
      z.strictObject({
        system: z.literal(PRODUCT_SYSTEM),
        code: z.enum(PRODUCTS),
        display: z.string().optional(),
      }),
    ]),
  }),
  eye: z.enum(EYES),
  sphere: numericDraft.optional(),
  cylinder: numericDraft.optional(),
  axis: numericDraft.optional(),
  add: numericDraft.optional(),
  power: numericDraft.optional(),
  backCurve: numericDraft.optional(),
  diameter: numericDraft.optional(),
  prism: z.array(prismSchema).optional(),
  duration: durationSchema.optional(),
  color: z.string().optional(),
  brand: z.string().optional(),
  note: z.array(z.object({ text: z.string() })).optional(),
});

export const prescriptionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  status: z.enum(STATUSES),
  created: z.string(),
  dateWritten: z.string(),
  context: prescriptionContextSchema.optional(),
  lensSpecification: z.array(lensSchema),
});

export type LensSpecification = z.infer<typeof lensSchema>;
export type Prism = z.infer<typeof prismSchema>;
export type Prescriber = z.infer<typeof prescriberSchema>;
export type PrescriptionContext = z.infer<typeof prescriptionContextSchema>;
export type VisionPrescription = z.infer<typeof prescriptionSchema>;

export type PrescriptionRead =
  | { kind: "empty" }
  | { kind: "invalid" }
  | { kind: "value"; prescription: VisionPrescription };

export function readPrescription(data: unknown): PrescriptionRead {
  if (data === undefined || (Array.isArray(data) && data.length === 0)) {
    return { kind: "empty" };
  }
  if (!Array.isArray(data) || data.length !== 1) return { kind: "invalid" };
  const parsed = prescriptionSchema.safeParse(data[0]);
  if (!parsed.success) return { kind: "invalid" };
  const keys = parsed.data.lensSpecification.map(
    (lens) => `${getProduct(lens)}.${lens.eye}`,
  );
  if (new Set(keys).size !== keys.length) return { kind: "invalid" };
  return { kind: "value", prescription: parsed.data };
}

export function localDate(date = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function newPrescription(now = new Date()): VisionPrescription {
  return {
    schemaVersion: 1,
    status: "active",
    created: now.toISOString(),
    dateWritten: localDate(now),
    lensSpecification: [],
  };
}

export function getProduct(lens: LensSpecification): Product {
  return lens.product.coding[0].code;
}

export function newLens(product: Product, eye: Eye): LensSpecification {
  return {
    product: { coding: [{ system: PRODUCT_SYSTEM, code: product }] },
    eye,
  };
}

export function getLens(
  prescription: VisionPrescription,
  product: Product,
  eye: Eye,
): LensSpecification | undefined {
  return prescription.lensSpecification.find(
    (lens) => getProduct(lens) === product && lens.eye === eye,
  );
}

export function hasLensValues(lens: LensSpecification): boolean {
  return Object.entries(lens).some(([key, value]) => {
    if (key === "product" || key === "eye") return false;
    if (value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

export function updateLens(
  prescription: VisionPrescription,
  product: Product,
  eye: Eye,
  update: (lens: LensSpecification) => LensSpecification,
): VisionPrescription {
  const next = update(
    getLens(prescription, product, eye) ?? newLens(product, eye),
  );
  const lenses = prescription.lensSpecification.filter(
    (lens) => !(getProduct(lens) === product && lens.eye === eye),
  );
  if (hasLensValues(next)) lenses.push(next);
  lenses.sort(
    (a, b) =>
      PRODUCTS.indexOf(getProduct(a)) - PRODUCTS.indexOf(getProduct(b)) ||
      EYES.indexOf(a.eye) - EYES.indexOf(b.eye),
  );
  return { ...prescription, lensSpecification: lenses };
}

export function setLensField(
  lens: LensSpecification,
  field: NumericField | "color" | "brand",
  value: NumericValue | undefined,
): LensSpecification {
  if (field === "color" || field === "brand") {
    return {
      ...lens,
      [field]: value === undefined ? undefined : String(value),
    };
  }
  return { ...lens, [field]: value };
}

export function prismPlane(base: PrismBase): PrismPlane {
  return base === "in" || base === "out" ? "horizontal" : "vertical";
}

export function getPrism(
  lens: LensSpecification,
  plane: PrismPlane,
): Prism | undefined {
  return lens.prism?.find(
    (prism) =>
      (prism.base ? prismPlane(prism.base) : prism.draftPlane) === plane,
  );
}

export function setPrism(
  lens: LensSpecification,
  plane: PrismPlane,
  update: Partial<Prism>,
): LensSpecification {
  const current = getPrism(lens, plane);
  const next: Prism = { ...current, ...update };
  next.draftPlane = next.base ? undefined : plane;
  const prisms = (lens.prism ?? []).filter(
    (prism) =>
      (prism.base ? prismPlane(prism.base) : prism.draftPlane) !== plane,
  );
  if (next.amount !== undefined || next.base !== undefined) prisms.push(next);
  prisms.sort((a, b) => {
    const aPlane = a.base ? prismPlane(a.base) : "";
    const bPlane = b.base ? prismPlane(b.base) : "";
    return aPlane.localeCompare(bPlane);
  });
  return { ...lens, prism: prisms.length > 0 ? prisms : undefined };
}

export function setDuration(
  lens: LensSpecification,
  value: NumericValue | undefined,
  code: DurationUnit | undefined,
): LensSpecification {
  return {
    ...lens,
    duration:
      value === undefined && code === undefined
        ? undefined
        : {
            value,
            code,
            system: UCUM_SYSTEM,
            unit: code ? DURATION_LABELS[code] : undefined,
          },
  };
}

// Keep an incomplete decimal in the draft so submit can reject it.
export function parseNumericInput(raw: string): NumericValue | undefined {
  if (raw === "") return undefined;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) {
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return raw;
}

export function formatNumeric(
  value: NumericValue | undefined,
  signed = false,
): string {
  if (value === undefined) return "-";
  if (typeof value !== "number" || !Number.isFinite(value))
    return String(value);
  const number = Object.is(value, -0) ? 0 : value;
  if (signed) {
    const exact = Math.abs(number * 100 - Math.round(number * 100)) < 1e-8;
    return `${number >= 0 ? "+" : ""}${exact ? number.toFixed(2) : String(number)}`;
  }
  return String(number);
}

export function formatDate(value: string, locale = "en"): string {
  if (!isValidDate(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

export function contextMatches(
  prescription: VisionPrescription,
  patientId: string,
  encounterId: string,
): boolean {
  return (
    !prescription.context ||
    (prescription.context.patientId === patientId &&
      prescription.context.encounterId === encounterId)
  );
}
