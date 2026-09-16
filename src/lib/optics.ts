import { EYES, PRODUCTS } from "./constants";
import {
  type Eye,
  type LensSpecification,
  type Product,
  type VisionPrescription,
  formatNumeric,
  getLens,
  getProduct,
} from "./prescription";
import type { MessageKey } from "./validate";

/**
 * Optical helpers for the lens diagram, the transpose control, and the soft
 * clinical hints. These functions read a lens. They do not validate it.
 * `validate.ts` stays the single authority on what the form accepts.
 */

/** The two meridians of a sphero-cylinder lens, in dioptres. */
export interface PowerCross {
  /** The cylinder axis, 0 to 180, in TABO notation. */
  axis: number;
  /** The power along the axis meridian. This is the sphere. */
  alongAxis: number;
  /** The power 90 degrees from the axis. This is sphere + cylinder. */
  acrossAxis: number;
}

export type CylinderForm = "plus" | "minus";

export interface ClinicalHint {
  product: Product;
  eye?: Eye;
  message: MessageKey;
  values?: Record<string, string>;
}

/** Spherical equivalents that differ by this value or more get a hint. */
export const ANISOMETROPIA_LIMIT = 2.5;
/** A primary power above this magnitude gets a hint. */
export const HIGH_POWER_LIMIT = 10;

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round2(value: number): number {
  // toFixed rounds the exact decimal value, so 4.375 gives 4.38.
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function primaryField(product: Product): "sphere" | "power" {
  return product === "lens" ? "sphere" : "power";
}

export function primaryPower(
  lens: LensSpecification,
  product = getProduct(lens),
): number | undefined {
  const value = lens[primaryField(product)];
  return isFiniteNumber(value) ? value : undefined;
}

/** True when the lens has a complete numeric sphere, cylinder, and axis. */
export function canTranspose(
  lens: LensSpecification | undefined,
  product?: Product,
): boolean {
  if (!lens) return false;
  return (
    primaryPower(lens, product) !== undefined &&
    isFiniteNumber(lens.cylinder) &&
    lens.cylinder !== 0 &&
    isFiniteNumber(lens.axis)
  );
}

/**
 * Writes the same lens in the other cylinder form.
 *
 * The new sphere is sphere + cylinder. The new cylinder has the opposite
 * sign. The new axis turns 90 degrees and stays in 1 to 180. The function
 * returns the lens unchanged when the lens is not complete.
 */
export function transposeLens(
  lens: LensSpecification,
  product = getProduct(lens),
): LensSpecification {
  if (!canTranspose(lens, product)) return lens;
  const field = primaryField(product);
  const sphere = lens[field] as number;
  const cylinder = lens.cylinder as number;
  const axis = lens.axis as number;
  let nextAxis = (axis + 90) % 180;
  if (nextAxis === 0) nextAxis = 180;
  return {
    ...lens,
    [field]: round2(sphere + cylinder),
    cylinder: round2(-cylinder),
    axis: nextAxis,
  };
}

export function cylinderForm(
  lens: LensSpecification | undefined,
): CylinderForm | undefined {
  if (!lens || !isFiniteNumber(lens.cylinder) || lens.cylinder === 0)
    return undefined;
  return lens.cylinder > 0 ? "plus" : "minus";
}

/** The optical cross for a lens with a complete sphere, cylinder, and axis. */
export function powerCross(
  lens: LensSpecification | undefined,
  product?: Product,
): PowerCross | undefined {
  if (!lens || !canTranspose(lens, product)) return undefined;
  const sphere = primaryPower(lens, product) as number;
  return {
    axis: lens.axis as number,
    alongAxis: sphere,
    acrossAxis: round2(sphere + (lens.cylinder as number)),
  };
}

/** Writes `sphere / cylinder x axis` for the other cylinder form. */
export function formatTransposed(
  lens: LensSpecification | undefined,
  product?: Product,
): string {
  if (!lens || !canTranspose(lens, product)) return "";
  const next = transposeLens(lens, product);
  const field = primaryField(product ?? getProduct(lens));
  return `${formatNumeric(next[field], true)} / ${formatNumeric(next.cylinder, true)} x ${formatNumeric(next.axis)}`;
}

/** Sphere + half the cylinder. The single power nearest to the lens. */
export function sphericalEquivalent(
  lens: LensSpecification | undefined,
  product?: Product,
): number | undefined {
  if (!lens) return undefined;
  const sphere = primaryPower(lens, product);
  if (sphere === undefined) return undefined;
  const cylinder = isFiniteNumber(lens.cylinder) ? lens.cylinder : 0;
  return round2(sphere + cylinder / 2);
}

/**
 * Soft hints for values that are valid but unusual.
 *
 * A hint does not block the form. It asks the clinician to check a value
 * that is often a typing error.
 */
export function getClinicalHints(
  prescription: VisionPrescription,
  onlyProduct?: Product,
): ClinicalHint[] {
  const hints: ClinicalHint[] = [];
  const products = onlyProduct ? [onlyProduct] : PRODUCTS;

  for (const product of products) {
    const right = getLens(prescription, product, "right");
    const left = getLens(prescription, product, "left");

    for (const eye of EYES) {
      const lens = eye === "right" ? right : left;
      const power = lens && primaryPower(lens, product);
      if (power !== undefined && Math.abs(power) > HIGH_POWER_LIMIT) {
        hints.push({
          product,
          eye,
          message: "hint_high_power",
          values: { limit: String(HIGH_POWER_LIMIT) },
        });
      }
    }

    const rightSE = sphericalEquivalent(right, product);
    const leftSE = sphericalEquivalent(left, product);
    if (rightSE !== undefined && leftSE !== undefined) {
      const difference = round2(Math.abs(rightSE - leftSE));
      if (difference >= ANISOMETROPIA_LIMIT) {
        hints.push({
          product,
          message: "hint_anisometropia",
          values: { difference: difference.toFixed(2) },
        });
      }
    }

    const rightForm = cylinderForm(right);
    const leftForm = cylinderForm(left);
    if (rightForm && leftForm && rightForm !== leftForm) {
      hints.push({ product, message: "hint_mixed_cylinder" });
    }

    if (
      right &&
      left &&
      isFiniteNumber(right.add) &&
      isFiniteNumber(left.add) &&
      right.add !== left.add
    ) {
      hints.push({ product, message: "hint_add_differs" });
    }
  }
  return hints;
}
