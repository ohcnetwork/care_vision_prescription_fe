import type { NumericField, NumericValue } from "./prescription";

/**
 * Generated dropdown values for the numeric fields.
 *
 * The steps and the bounds below agree with the rules in `validate.ts`, so a
 * generated value always passes validation. The bounds limit the suggestions
 * only. A clinician can still type a value outside them, and validation stays
 * the single authority on what the form accepts.
 */
export type SuggestKind =
  "dioptre" | "add" | "axis" | "prism" | "backCurve" | "diameter" | "duration";

interface SuggestSpec {
  /** Matches the quantisation that `validate.ts` enforces. */
  step: number;
  /** The step for Shift + arrow key. */
  bigStep: number;
  min: number;
  max: number;
  decimals: number;
  /** True when the value carries a polarity, so the list offers both signs. */
  signed: boolean;
  /** Shown while the field is empty. These are the values clinicians use most. */
  common?: number[];
}

const SPECS: Record<SuggestKind, SuggestSpec> = {
  // validate.ts accepts any 0.25 step. +/-30 D covers the prescribable range.
  dioptre: {
    step: 0.25,
    bigStep: 1,
    min: -30,
    max: 30,
    decimals: 2,
    signed: true,
  },
  // A reading addition is positive in practice.
  add: {
    step: 0.25,
    bigStep: 1,
    min: 0.25,
    max: 6,
    decimals: 2,
    signed: true,
    common: [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3],
  },
  // validate.ts requires an integer from 0 to 180.
  axis: {
    step: 1,
    bigStep: 5,
    min: 0,
    max: 180,
    decimals: 0,
    signed: false,
    common: [
      0, 10, 20, 30, 45, 60, 70, 80, 90, 100, 110, 120, 135, 150, 160, 170, 180,
    ],
  },
  // validate.ts requires a non-negative amount.
  prism: {
    step: 0.25,
    bigStep: 1,
    min: 0,
    max: 20,
    decimals: 2,
    signed: false,
    common: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10],
  },
  // validate.ts requires a value above 0. These are contact lens base curves.
  backCurve: {
    step: 0.1,
    bigStep: 0.5,
    min: 6,
    max: 10.5,
    decimals: 1,
    signed: false,
    common: [8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 9],
  },
  // validate.ts requires a value above 0. These are contact lens diameters.
  diameter: {
    step: 0.1,
    bigStep: 0.5,
    min: 8,
    max: 16,
    decimals: 1,
    signed: false,
    common: [13.8, 14, 14.2, 14.5, 14.8],
  },
  // validate.ts requires a value above 0.
  duration: {
    step: 1,
    bigStep: 7,
    min: 1,
    max: 730,
    decimals: 0,
    signed: false,
    common: [1, 7, 14, 30, 60, 90, 180, 365],
  },
};

/** The part of a spec that the dial popup needs to draw itself. */
export type DialSpec = Readonly<
  Pick<SuggestSpec, "step" | "bigStep" | "min" | "max" | "decimals" | "common">
>;

export function dialSpec(kind: SuggestKind): DialSpec {
  return SPECS[kind];
}

/**
 * Snaps a value to the nearest step inside the bounds. The dial uses this for
 * a drag or a wheel, where the pointer lands between two steps.
 */
export function snapValue(kind: SuggestKind, value: number): number {
  const spec = SPECS[kind];
  const snapped = quantize(
    Math.round(value / spec.step) * spec.step,
    spec.decimals,
  );
  return Math.min(spec.max, Math.max(spec.min, snapped));
}

export function kindForField(field: NumericField): SuggestKind {
  switch (field) {
    case "axis":
      return "axis";
    case "add":
      return "add";
    case "backCurve":
      return "backCurve";
    case "diameter":
      return "diameter";
    default:
      return "dioptre";
  }
}

/**
 * Moves a value by one step, as an arrow key on a phoropter dial does.
 *
 * An empty field starts from 0. The result stays inside the suggestion
 * bounds. A value that is not a number does not move.
 */
export function stepValue(
  kind: SuggestKind,
  value: NumericValue | undefined,
  direction: 1 | -1,
  big = false,
): number | undefined {
  if (value !== undefined && typeof value !== "number") return undefined;
  const spec = SPECS[kind];
  const start = value ?? 0;
  const step = big ? spec.bigStep : spec.step;
  const next = quantize(start + direction * step, spec.decimals);
  // A typed value outside the bounds keeps its freedom. The clamp only stops
  // a key from pushing a usual value past the bounds.
  if (start < spec.min || start > spec.max) return next;
  return Math.min(spec.max, Math.max(spec.min, next));
}

function quantize(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** The text put into the field when the clinician selects a suggestion. */
export function suggestionLabel(value: number, kind: SuggestKind): string {
  const spec = SPECS[kind];
  const magnitude = Math.abs(value).toFixed(spec.decimals);
  if (value < 0) return `-${magnitude}`;
  return spec.signed ? `+${magnitude}` : magnitude;
}

/**
 * Builds the dropdown values for what the clinician typed so far.
 *
 * An empty field shows the common values. Otherwise the list holds every valid
 * step whose magnitude starts with the typed digits. A typed sign narrows the
 * list to that polarity.
 */
export function suggestValues(
  kind: SuggestKind,
  raw: string,
  limit = 16,
): number[] {
  const spec = SPECS[kind];
  const text = raw.trim();

  if (text === "") {
    if (spec.common) return spec.common.slice(0, limit);
    return ladder(spec, limit);
  }

  const sign = text.startsWith("-") ? -1 : text.startsWith("+") ? 1 : 0;
  let digits = text.replace(/^[+-]/, "");
  // A trailing separator means the clinician is still part way through a
  // decimal, so match on the whole part alone.
  if (digits.endsWith(".")) digits = digits.slice(0, -1);
  if (digits === "") return ladder(spec, limit, sign);
  if (!/^\d+(?:\.\d*)?$/.test(digits)) return [];

  const matches: number[] = [];
  const count = Math.round((spec.max - spec.min) / spec.step);
  for (let index = 0; index <= count; index += 1) {
    const value = quantize(spec.min + index * spec.step, spec.decimals);
    if (sign === -1 && value > 0) continue;
    if (sign === 1 && value < 0) continue;
    if (!Math.abs(value).toFixed(spec.decimals).startsWith(digits)) continue;
    matches.push(value);
  }
  return order(matches).slice(0, limit);
}

/** Values closest to the start of the range, used when nothing is typed. */
function ladder(spec: SuggestSpec, limit: number, sign = 0): number[] {
  const values: number[] = [];
  const count = Math.round((spec.max - spec.min) / spec.step);
  for (let index = 0; index <= count; index += 1) {
    const value = quantize(spec.min + index * spec.step, spec.decimals);
    if (sign === -1 && value > 0) continue;
    if (sign === 1 && value < 0) continue;
    values.push(value);
  }
  return order(values).slice(0, limit);
}

/** Smallest magnitude first, and a positive value before its negative twin. */
function order(values: number[]): number[] {
  const seen = new Set<number>();
  return values
    .filter((value) => {
      const key = value === 0 ? 0 : value;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const magnitude = Math.abs(left) - Math.abs(right);
      if (Math.abs(magnitude) > 1e-9) return magnitude;
      return Math.sign(right) - Math.sign(left);
    });
}
