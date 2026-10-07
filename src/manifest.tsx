import { Glasses } from "lucide-react";
import { lazy } from "react";

import en from "../public/locale/en.json";
import { PLUGIN_SLUG, VISION_PRESCRIPTION_TYPE } from "./lib/constants";
import { PRESCRIPTION_DETAILS_SCHEMA, VISION_SCHEMA } from "./lib/group";
import {
  validateLensGroup,
  validatePrescriptionDetails,
} from "./lib/groupValidation";
import type { PluginManifest } from "./types/host";

const manifest = {
  plugin: PLUGIN_SLUG,
  registeredQuestionGroups: [
    {
      type: `${PLUGIN_SLUG}.prescription_details`,
      label: en.prescription_details,
      icon: Glasses,
      schema: PRESCRIPTION_DETAILS_SCHEMA,
      validate: validatePrescriptionDetails,
      builder: () => null,
      component: lazy(
        () =>
          import("./components/vision-prescription/PrescriptionDetailsInput"),
      ),
      subjects: ["encounter"],
    },
    {
      type: VISION_PRESCRIPTION_TYPE,
      label: en.lens_specification,
      icon: Glasses,
      component: lazy(
        () =>
          import("./components/vision-prescription/VisionPrescriptionInput"),
      ),
      schema: VISION_SCHEMA,
      validate: validateLensGroup,
      repeats: true,
      builder: () => null,
      subjects: ["encounter"],
    },
  ],
} as const satisfies PluginManifest;

export default manifest;
