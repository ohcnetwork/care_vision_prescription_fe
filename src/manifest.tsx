import { Glasses } from "lucide-react";
import { lazy } from "react";

import en from "../public/locale/en.json";
import { PLUGIN_SLUG, VISION_PRESCRIPTION_TYPE } from "./lib/constants";
import { validateVisionPrescription } from "./lib/validate";
import type { PluginManifest } from "./types/host";

const manifest = {
  plugin: PLUGIN_SLUG,
  structuredQuestionTypes: [
    {
      type: VISION_PRESCRIPTION_TYPE,
      label: en.title,
      icon: Glasses,
      component: lazy(
        () =>
          import("./components/vision-prescription/VisionPrescriptionInput"),
      ),
      // Studio preview has no patient. Submit validation requires the context.
      requires: [],
      subjects: ["encounter"],
      draftPolicy: "serialize",
      persistence: "response",
      validate: validateVisionPrescription,
    },
  ],
} as const satisfies PluginManifest;

export default manifest;
