import {
  type LensSpecification,
  type PrismBase,
  type Product,
  formatNumeric,
  getPrism,
} from "./prescription";

/**
 * The international short form for a prism base. Clinicians read these the
 * same way in every language, so they are not translated.
 */
const BASE_SHORT: Record<PrismBase, string> = {
  in: "BI",
  out: "BO",
  up: "BU",
  down: "BD",
};

/**
 * Writes one lens in the notation that a clinician reads on a prescription.
 *
 * The form is `sphere / cylinder x axis`, then the addition, then the prism.
 * A dash marks a value that the pair needs but does not have yet, which shows
 * an incomplete entry at a glance. An empty lens gives an empty string.
 */
export function formatRxLine(
  lens: LensSpecification | undefined,
  product: Product,
): string {
  if (!lens) return "";
  const power = product === "lens" ? lens.sphere : lens.power;
  const segments: string[] = [];

  if (
    power !== undefined ||
    lens.cylinder !== undefined ||
    lens.axis !== undefined
  ) {
    let optic = power !== undefined ? formatNumeric(power, true) : "--";
    if (lens.cylinder !== undefined || lens.axis !== undefined) {
      const cylinder =
        lens.cylinder !== undefined ? formatNumeric(lens.cylinder, true) : "--";
      const axis = lens.axis !== undefined ? formatNumeric(lens.axis) : "--";
      optic += ` / ${cylinder} x ${axis}`;
    }
    segments.push(optic);
  }

  if (lens.add !== undefined)
    segments.push(`Add ${formatNumeric(lens.add, true)}`);

  for (const plane of ["horizontal", "vertical"] as const) {
    const prism = getPrism(lens, plane);
    if (!prism) continue;
    if (prism.amount === undefined && prism.base === undefined) continue;
    const amount =
      prism.amount !== undefined ? formatNumeric(prism.amount) : "--";
    segments.push(`${amount} ${prism.base ? BASE_SHORT[prism.base] : "--"}`);
  }

  return segments.join("   ");
}
