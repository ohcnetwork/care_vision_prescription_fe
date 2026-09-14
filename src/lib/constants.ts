export const PLUGIN_SLUG = "care_vision_prescription_fe";
export const VISION_PRESCRIPTION_TYPE = `${PLUGIN_SLUG}.vision_prescription`;
export const PRODUCT_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/ex-visionprescriptionproduct";
export const UCUM_SYSTEM = "http://unitsofmeasure.org";

export const PRODUCTS = ["lens", "contact"] as const;
export const EYES = ["right", "left"] as const;
export const STATUSES = [
  "draft",
  "active",
  "cancelled",
  "entered-in-error",
] as const;
export const PRISM_BASES = ["in", "out", "up", "down"] as const;
export const DURATION_UNITS = ["h", "d", "wk", "mo"] as const;

export const DURATION_LABELS = {
  h: "hours",
  d: "days",
  wk: "weeks",
  mo: "months",
} as const;
