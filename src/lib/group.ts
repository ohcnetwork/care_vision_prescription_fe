import en from "../../public/locale/en.json";
import type {
  GroupField,
  GroupInputProps,
  GroupQuestionDefinition,
  GroupRow,
  QuestionnaireResponse,
} from "../types/host";
import {
  DURATION_LABELS,
  DURATION_UNITS,
  EYES,
  PRODUCTS,
  STATUSES,
  UCUM_SYSTEM,
} from "./constants";
import {
  type LensSpecification,
  type PrescriptionRead,
  type VisionPrescription,
  getPrism,
  getProduct,
  lensSchema,
  localDate,
  newLens,
  prescriptionSchema,
} from "./prescription";

type Fields = Record<string, GroupField | null>;
type Scalar = string | number | undefined;
const NUMERIC = [
  "sphere",
  "power",
  "cylinder",
  "axis",
  "add",
  "backCurve",
  "diameter",
] as const;
const PLANES = ["horizontal", "vertical"] as const;
export const groupKey = (key: string) => key.replaceAll(".", "_");

const field = (
  link_id: string,
  text: string,
  type: GroupQuestionDefinition["type"],
  options?: readonly string[],
): GroupQuestionDefinition => ({
  link_id,
  text,
  type,
  ...(options ? { answer_option: options.map((value) => ({ value })) } : {}),
});

export const PRESCRIPTION_DETAILS_SCHEMA: readonly GroupQuestionDefinition[] = [
  { ...field("status", en.status, "choice", STATUSES), required: true },
  { ...field("dateWritten", en.dateWritten, "dateTime"), required: true },
];

export const VISION_SCHEMA: readonly GroupQuestionDefinition[] = [
  field("note", en.note, "text"),
  { ...field("product", en.product, "choice", PRODUCTS), required: true },
  { ...field("eye", en.eye, "choice", EYES), required: true },
  ...NUMERIC.map((name) =>
    field(name, en[name], name === "axis" ? "integer" : "decimal"),
  ),
  ...PLANES.flatMap((plane) => [
    field(
      `prism_${plane}_amount`,
      `${en[`prism_${plane}`]} ${en.prism_amount}`,
      "decimal",
    ),
    field(
      `prism_${plane}_base`,
      `${en[`prism_${plane}`]} ${en.prism_base}`,
      "choice",
      plane === "horizontal" ? ["in", "out"] : ["up", "down"],
    ),
  ]),
  field("duration", en.duration, "decimal"),
  field("durationCode", en.duration_unit, "choice", DURATION_UNITS),
  field("color", en.color, "string"),
  field("brand", en.brand, "string"),
];

export function prescriptionValues(
  lens: LensSpecification,
): Record<string, Scalar> {
  const values: Record<string, Scalar> = {
    note: lens.note?.[0]?.text,
    product: getProduct(lens),
    eye: lens.eye,
    duration: lens.duration?.value,
    durationCode: lens.duration?.code,
    color: lens.color,
    brand: lens.brand,
  };
  for (const name of NUMERIC) values[name] = lens[name];
  for (const plane of PLANES) {
    const prism = getPrism(lens, plane);
    values[`prism_${plane}_amount`] = prism?.amount;
    values[`prism_${plane}_base`] = prism?.base;
  }
  return values;
}

export function fieldValue(fields: Fields, key: string): Scalar {
  const binding = fields[groupKey(key)];
  if (!binding || binding.hidden) return undefined;
  const value = binding.response.values[0]?.value;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return binding.question.type === "date"
      ? localDate(value)
      : value.toISOString();
  }
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}

export function readGroupPrescription(rows: GroupRow[]): PrescriptionRead {
  if (!rows.length) return { kind: "empty" };
  const lenses = [];
  const identities = new Set<string>();
  for (const { fields } of rows) {
    const parsed = readLens((key) => fieldValue(fields, key));
    if (
      !parsed.success ||
      Object.values(fields).some(
        (field) => field && !field.hidden && field.response.values.length > 1,
      )
    )
      return { kind: "invalid" };
    const identity = `${getProduct(parsed.data)}.${parsed.data.eye}`;
    if (identities.has(identity)) return { kind: "invalid" };
    identities.add(identity);
    lenses.push(parsed.data);
  }
  const parsed = prescriptionSchema.safeParse({
    schemaVersion: 1,
    status: "draft",
    created: "",
    dateWritten: "",
    lensSpecification: lenses,
  });
  return parsed.success
    ? { kind: "value", prescription: parsed.data }
    : { kind: "invalid" };
}

/** Read the same ordinary lens fields for visualization and submission validation. */
export function readLens(get: (key: string) => unknown) {
  const product = PRODUCTS.find((value) => value === get("product"));
  const eye = EYES.find((value) => value === get("eye"));
  if (!product || !eye) return lensSchema.safeParse({});
  const lens = {
    ...newLens(product, eye),
    ...Object.fromEntries(NUMERIC.map((name) => [name, get(name)])),
  };
  const prism = PLANES.flatMap((plane) => {
    const amount = get(`prism_${plane}_amount`);
    const base = get(`prism_${plane}_base`);
    return amount !== undefined || base !== undefined
      ? [{ amount, base, ...(base ? {} : { draftPlane: plane }) }]
      : [];
  });
  const duration = get("duration");
  const code = get("durationCode");
  return lensSchema.safeParse({
    ...lens,
    ...(get("note") !== undefined ? { note: [{ text: get("note") }] } : {}),
    ...(prism.length ? { prism } : {}),
    ...(duration !== undefined || code !== undefined
      ? {
          duration: {
            value: duration,
            code,
            system: UCUM_SYSTEM,
            unit: DURATION_LABELS[code as keyof typeof DURATION_LABELS],
          },
        }
      : {}),
    ...(get("color") !== undefined ? { color: get("color") } : {}),
    ...(get("brand") !== undefined ? { brand: get("brand") } : {}),
  });
}

export function groupUnavailable(fields: Fields, disabled = false): boolean {
  return VISION_SCHEMA.some(
    ({ link_id }) =>
      !fields[link_id] ||
      fields[link_id]?.hidden ||
      (!disabled && fields[link_id]?.disabled),
  );
}

/** Keep the table's product/eye cells backed by ordinary repeating rows. */
export function updatePrescriptionRows(
  { fields, rows, addRow, disabled, question }: GroupInputProps,
  prescription?: VisionPrescription,
) {
  if (
    disabled ||
    question.read_only ||
    groupUnavailable(fields) ||
    rows.some((row) => groupUnavailable(row.fields))
  )
    return;
  if (!prescription) {
    rows.forEach((row) => row.remove());
    return;
  }
  const lenses = prescription.lensSpecification;
  for (const row of rows) {
    const lens = lenses.find(
      (lens) =>
        getProduct(lens) === fieldValue(row.fields, "product") &&
        lens.eye === fieldValue(row.fields, "eye"),
    );
    if (!lens) row.remove();
    else {
      const updates = groupUpdates(row.fields, prescriptionValues(lens));
      if (Object.keys(updates).length) row.onChange(updates);
    }
  }
  for (const lens of lenses) {
    if (
      rows.some(
        (row) =>
          getProduct(lens) === fieldValue(row.fields, "product") &&
          lens.eye === fieldValue(row.fields, "eye"),
      )
    )
      continue;
    const values = prescriptionValues(lens);
    if (
      ["product", "eye"].some(
        (key) =>
          !fields[key]?.question.answer_option?.some(
            (option) => option.value === values[key],
          ),
      )
    )
      continue;
    addRow(groupUpdates(fields, values));
  }
}

/** Write only changed, available child answers. Identity and persistence belong to CARE. */
export function groupUpdates(
  fields: Fields,
  values: Record<string, Scalar>,
): Record<string, Partial<QuestionnaireResponse>> {
  return Object.fromEntries(
    Object.entries(fields).flatMap(([link_id, binding]) => {
      if (!binding || binding.disabled || binding.hidden) return [];
      const { type } = binding.question;
      const next = values[link_id];
      if (
        type === "choice" &&
        next !== undefined &&
        !binding.question.answer_option?.some((option) => option.value === next)
      )
        return [];
      if (fieldValue(fields, link_id) === next) return [];
      const responseType =
        type === "decimal" || type === "integer"
          ? "number"
          : type === "date" || type === "dateTime"
            ? type
            : "string";
      return [
        [
          link_id,
          {
            values:
              next === undefined || next === ""
                ? []
                : [
                    {
                      type: responseType,
                      value:
                        (type === "date" || type === "dateTime") &&
                        typeof next === "string"
                          ? new Date(
                              type === "date" ? `${next}T00:00:00` : next,
                            )
                          : next,
                    },
                  ],
          },
        ],
      ];
    }),
  );
}
