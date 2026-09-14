import i18next from "i18next";
import { createContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";

import en from "../public/locale/en.json";
import { Button } from "./components/ui/button";
import VisionPrescriptionInput from "./components/vision-prescription/VisionPrescriptionInput";
import { useTranslation } from "./hooks/useTranslation";
import {
  PLUGIN_SLUG,
  PRODUCT_SYSTEM,
  UCUM_SYSTEM,
  VISION_PRESCRIPTION_TYPE,
} from "./lib/constants";
import { PLUG_ROOT_CLASS } from "./lib/plug-root";
import { type VisionPrescription, newPrescription } from "./lib/prescription";
import { validateVisionPrescription } from "./lib/validate";
import { type CareAuthContext, getCareRuntime } from "./types/care";
import type {
  QuestionValidationError,
  QuestionnaireResponse,
} from "./types/host";

const patientId = "1a2c71ea-6004-4b6d-8010-942aec8d57c1";
const encounterId = "0b7c20da-27c8-4302-9b1f-1495c248f474";
const demoUser = {
  id: "5d53d212-c4a3-4775-a9c9-082bc584f3af",
  username: "preview-clinician",
  first_name: "Preview",
  last_name: "clinician",
};
getCareRuntime().AuthUserContext = createContext<CareAuthContext | null>({
  user: demoUser,
});

function samplePrescription(): VisionPrescription {
  return {
    ...newPrescription(),
    status: "active",
    context: {
      patientId,
      encounterId,
      prescriber: { id: demoUser.id, display: "Preview clinician" },
    },
    lensSpecification: [
      {
        product: { coding: [{ system: PRODUCT_SYSTEM, code: "lens" }] },
        eye: "right",
        sphere: -2.25,
        cylinder: -0.75,
        axis: 90,
        add: 1.5,
        prism: [{ amount: 1.5, base: "out" }],
      },
      {
        product: { coding: [{ system: PRODUCT_SYSTEM, code: "lens" }] },
        eye: "left",
        sphere: -1.75,
        cylinder: -0.5,
        axis: 85,
        add: 1.5,
      },
      {
        product: { coding: [{ system: PRODUCT_SYSTEM, code: "contact" }] },
        eye: "right",
        power: -2.25,
        backCurve: 8.6,
        diameter: 14.2,
        duration: { value: 8, unit: "hours", system: UCUM_SYSTEM, code: "h" },
      },
      {
        product: { coding: [{ system: PRODUCT_SYSTEM, code: "contact" }] },
        eye: "left",
        power: -1.75,
        backCurve: 8.6,
        diameter: 14.2,
        duration: { value: 8, unit: "hours", system: UCUM_SYSTEM, code: "h" },
      },
    ],
  };
}

function Standalone() {
  const { t } = useTranslation();
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [readOnly, setReadOnly] = useState(false);
  const [errors, setErrors] = useState<QuestionValidationError[]>([]);
  const [checked, setChecked] = useState(false);
  const [response, setResponse] = useState<QuestionnaireResponse>({
    question_id: "vision",
    link_id: "vision",
    structured_type: VISION_PRESCRIPTION_TYPE,
    values: [],
    note: "",
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.body.style.margin = "0";
  }, [dark]);

  return (
    <I18nextProvider i18n={i18next}>
      <main
        className={`${PLUG_ROOT_CLASS} min-h-dvh bg-background p-4 text-foreground sm:p-8`}
      >
        <div className="mx-auto max-w-6xl space-y-5">
          <header className="space-y-3 print:hidden">
            <h1 className="text-xl font-semibold">{t("title")}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {t("sample_description")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDark((value) => !value)}
              >
                {t(dark ? "light_mode" : "dark_mode")}
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={readOnly}
                onClick={() => setReadOnly((value) => !value)}
              >
                {t("read_only")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResponse((current) => ({
                    ...current,
                    values: [
                      {
                        type: VISION_PRESCRIPTION_TYPE,
                        value: [samplePrescription()],
                      },
                    ],
                    note: "",
                  }));
                  setErrors([]);
                  setChecked(false);
                }}
              >
                {t("sample_values")}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const value = response.values[0]?.value;
                  setErrors(
                    validateVisionPrescription(
                      Array.isArray(value) ? value : [],
                      "vision",
                      true,
                    ),
                  );
                  setChecked(true);
                }}
              >
                {t("test_answer")}
              </Button>
            </div>
          </header>
          <VisionPrescriptionInput
            question={{
              id: "vision",
              link_id: "vision",
              text: en.title,
              type: "structured",
              structured_type: VISION_PRESCRIPTION_TYPE,
              required: true,
            }}
            response={response}
            onChange={(values, note) => {
              setResponse((current) => ({
                ...current,
                values,
                note: note ?? current.note,
              }));
              setChecked(false);
            }}
            disabled={readOnly}
            errors={errors}
            clearError={() => setErrors([])}
            patientId={patientId}
            encounterId={encounterId}
          />
          {checked && (
            <div
              role={errors.length > 0 ? "alert" : "status"}
              className="text-sm print:hidden"
            >
              {errors.length > 0 ? (
                <ul className="list-inside list-disc text-destructive">
                  {errors.map((error, index) => (
                    <li key={index}>{error.error}</li>
                  ))}
                </ul>
              ) : (
                t("valid_answer")
              )}
            </div>
          )}
          <details className="print:hidden">
            <summary className="cursor-pointer text-sm">
              {t("answer_data")}
            </summary>
            <pre
              data-testid="answer-data"
              className="mt-3 overflow-auto rounded-md bg-muted p-4 text-xs"
            >
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </div>
      </main>
    </I18nextProvider>
  );
}

await i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  defaultNS: PLUGIN_SLUG,
  resources: { en: { [PLUGIN_SLUG]: en } },
  interpolation: { escapeValue: false },
});

const root = document.getElementById("root");
if (!root) throw new Error("The preview root does not exist.");
createRoot(root).render(<Standalone />);
