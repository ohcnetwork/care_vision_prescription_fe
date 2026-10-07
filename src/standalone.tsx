import i18next from "i18next";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";

import en from "../public/locale/en.json";
import { Button } from "./components/ui/button";
import PrescriptionDetailsInput from "./components/vision-prescription/PrescriptionDetailsInput";
import VisionPrescriptionInput from "./components/vision-prescription/VisionPrescriptionInput";
import { useTranslation } from "./hooks/useTranslation";
import {
  PLUGIN_SLUG,
  PRODUCT_SYSTEM,
  UCUM_SYSTEM,
  VISION_PRESCRIPTION_TYPE,
} from "./lib/constants";
import {
  PRESCRIPTION_DETAILS_SCHEMA,
  VISION_SCHEMA,
  groupUpdates,
  prescriptionValues,
} from "./lib/group";
import { PLUG_ROOT_CLASS } from "./lib/plug-root";
import { type VisionPrescription, newPrescription } from "./lib/prescription";
import type {
  GroupField,
  GroupQuestionDefinition,
  Question,
  QuestionnaireResponse,
} from "./types/host";

function samplePrescription(): VisionPrescription {
  return {
    ...newPrescription(),
    status: "active",
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
  const question: Question = {
    id: "vision",
    link_id: "vision",
    text: en.title,
    type: "group",
    structured_type: VISION_PRESCRIPTION_TYPE,
    required: true,
    repeats: true,
  };
  const makeFields = (
    schema: readonly GroupQuestionDefinition[],
  ): Record<string, GroupField | null> =>
    Object.fromEntries(
      schema.map((child) => [
        child.link_id,
        {
          question: { ...child, id: child.link_id, questions: undefined },
          response: {
            question_id: child.link_id,
            link_id: child.link_id,
            structured_type: null,
            values: [],
          },
          disabled: false,
          hidden: false,
          errors: [],
        },
      ]),
    );
  const [fields] = useState(() => makeFields(VISION_SCHEMA));
  const [details, setDetails] = useState(() =>
    makeFields(PRESCRIPTION_DETAILS_SCHEMA),
  );
  const [answers, setAnswers] = useState<Record<string, GroupField | null>[]>(
    [],
  );
  const withUpdates = (
    current: typeof fields,
    updates: Record<string, Partial<QuestionnaireResponse>>,
  ) =>
    Object.fromEntries(
      Object.entries(current).map(([key, binding]) => [
        key,
        binding
          ? { ...binding, response: { ...binding.response, ...updates[key] } }
          : null,
      ]),
    );
  const addRow = (
    updates: Record<string, Partial<QuestionnaireResponse>> = {},
  ) => setAnswers((current) => [...current, withUpdates(fields, updates)]);
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
                  const sample = samplePrescription();
                  setAnswers(
                    sample.lensSpecification.map((lens) =>
                      withUpdates(
                        fields,
                        groupUpdates(fields, prescriptionValues(lens)),
                      ),
                    ),
                  );
                }}
              >
                {t("sample_values")}
              </Button>
            </div>
          </header>
          <PrescriptionDetailsInput
            question={{ ...question, repeats: false }}
            fields={details}
            rows={[]}
            addRow={() => {}}
            disabled={readOnly}
            onChange={(updates) =>
              setDetails((current) => withUpdates(current, updates))
            }
          />
          <VisionPrescriptionInput
            question={question}
            fields={fields}
            rows={answers.map((row) => ({
              fields: row,
              onChange: (updates) =>
                setAnswers((current) =>
                  current.map((entry) =>
                    entry === row ? withUpdates(entry, updates) : entry,
                  ),
                ),
              remove: () =>
                setAnswers((current) =>
                  current.filter((entry) => entry !== row),
                ),
            }))}
            addRow={addRow}
            onChange={() => {}}
            disabled={readOnly}
          />
          <details className="print:hidden">
            <summary className="cursor-pointer text-sm">
              {t("answer_data")}
            </summary>
            <pre
              data-testid="answer-data"
              className="mt-3 overflow-auto rounded-md bg-muted p-4 text-xs"
            >
              {JSON.stringify(
                {
                  question_id: question.id,
                  values: [],
                  sub_results: answers.map((row) =>
                    Object.values(row).map((field) => field?.response),
                  ),
                },
                null,
                2,
              )}
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
