import { useId, useMemo, useState } from "react";

import { usePrescriptionContext } from "../../hooks/usePrescriptionContext";
import { useTranslation } from "../../hooks/useTranslation";
import { EYES, STATUSES, VISION_PRESCRIPTION_TYPE } from "../../lib/constants";
import { PLUG_ROOT_CLASS } from "../../lib/plug-root";
import {
  type Eye,
  type LensSpecification,
  type Product,
  type VisionPrescription,
  contextMatches,
  localDate,
  newPrescription,
  readPrescription,
  updateLens,
} from "../../lib/prescription";
import { getPrescriptionIssues } from "../../lib/validate";
import "../../style/index.css";
import type { StructuredInputProps } from "../../types/host";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import { Textarea } from "../ui/textarea";
import { ContactDetails } from "./ContactDetails";
import { LensTable } from "./LensTable";
import { PrescriptionHistory } from "./PrescriptionHistory";
import { PrescriptionSummary } from "./PrescriptionSummary";
import "./prescription.css";

export default function VisionPrescriptionInput({
  question,
  response,
  onChange,
  disabled,
  errors,
  clearError,
  patientId,
  encounterId,
  facilityId,
  questionnaireId,
}: StructuredInputProps) {
  const { t } = useTranslation();
  const id = useId();
  const [empty] = useState(newPrescription);
  const stored = useMemo(
    () =>
      response.values.length > 1
        ? { kind: "invalid" as const }
        : readPrescription(response.values[0]?.value),
    [response.values],
  );
  const prescription = stored.kind === "value" ? stored.prescription : empty;
  const liveContext = usePrescriptionContext(
    patientId,
    encounterId,
    facilityId,
  );
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const readOnly = disabled || !!question.read_only;
  const mismatch = !!(
    patientId &&
    encounterId &&
    !contextMatches(prescription, patientId, encounterId)
  );
  const issues = getPrescriptionIssues(prescription);
  const errorFor = (key: string) => {
    if (!showErrors && errors.length === 0 && !touched.has(key))
      return undefined;
    const issue = issues.find((item) => item.field === key);
    return issue ? t(issue.message) : undefined;
  };
  const onTouched = (key: string) =>
    setTouched((current) => new Set(current).add(key));
  const prescriber =
    prescription.context?.prescriber ?? liveContext?.prescriber;

  const commit = (next: VisionPrescription, note = response.note) => {
    const context = next.context
      ? {
          ...next.context,
          prescriber: next.context.prescriber ?? liveContext?.prescriber,
        }
      : liveContext;
    onChange(
      [{ type: VISION_PRESCRIPTION_TYPE, value: [{ ...next, context }] }],
      note ?? "",
    );
    if (errors.length > 0) {
      setShowErrors(true);
      clearError();
    }
  };
  const onUpdate = (
    product: Product,
    eye: Eye,
    update: (lens: LensSpecification) => LensSpecification,
  ) => commit(updateLens(prescription, product, eye, update));
  const onUpdateEyes = (
    product: Product,
    update: (lens: LensSpecification, eye: Eye) => LensSpecification,
  ) =>
    commit(
      EYES.reduce(
        (current, eye) =>
          updateLens(current, product, eye, (lens) => update(lens, eye)),
        prescription,
      ),
    );

  const clear = () => {
    onChange([], "");
    clearError();
    setConfirmClear(false);
    setTouched(new Set());
    setShowErrors(false);
  };

  const clearControl = (
    <div className="vision-controls space-y-2">
      <Button
        type="button"
        variant="ghost"
        disabled={response.values.length === 0 && !response.note}
        onClick={() => setConfirmClear(true)}
      >
        {t("clear_question")}
      </Button>
      {confirmClear && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm"
        >
          <p>{t("clear_warning")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clear}>
              {t("clear_question")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmClear(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`${PLUG_ROOT_CLASS} vision-question min-w-0 space-y-4 rounded-lg border bg-card p-4 text-card-foreground`}
    >
      {stored.kind === "invalid" || mismatch ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {t(mismatch ? "context_mismatch" : "error_answer")}
          </p>
          {!readOnly && clearControl}
        </div>
      ) : readOnly ? (
        stored.kind === "value" ? (
          <PrescriptionSummary
            prescription={prescription}
            note={response.note}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty_answer")}</p>
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`${id}-date`}>{t("dateWritten")}</Label>
              <Input
                id={`${id}-date`}
                type="date"
                value={prescription.dateWritten}
                max={localDate()}
                aria-invalid={!!errorFor("dateWritten")}
                aria-describedby={`${id}-date-error`}
                className="h-9 font-mono"
                onChange={(event) =>
                  commit({ ...prescription, dateWritten: event.target.value })
                }
                onBlur={() => onTouched("dateWritten")}
              />
              <div id={`${id}-date-error`} className="vision-field-message">
                {errorFor("dateWritten")}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${id}-status`}>{t("status")}</Label>
              <NativeSelect
                id={`${id}-status`}
                value={prescription.status}
                className="h-9"
                onChange={(event) => {
                  const status = STATUSES.find(
                    (value) => value === event.target.value,
                  );
                  if (status) commit({ ...prescription, status });
                }}
              >
                {STATUSES.map((status) => (
                  <NativeSelectOption key={status} value={status}>
                    {t(status)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium">{t("prescriber")}</p>
              <p className="min-h-9 py-1.5">
                {prescriber?.display ?? t("care_context")}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("lens_note")}</p>
          <section className="space-y-2" aria-labelledby={`${id}-spectacles`}>
            <h3 id={`${id}-spectacles`} className="text-sm font-semibold">
              {t("lens")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("cylinder_hint")}
            </p>
            <LensTable
              prescription={prescription}
              product="lens"
              onUpdate={onUpdate}
              onUpdateEyes={onUpdateEyes}
              errorFor={errorFor}
              onTouched={onTouched}
            />
          </section>
          <section
            className="space-y-2 border-t pt-4"
            aria-labelledby={`${id}-contact`}
          >
            <h3 id={`${id}-contact`} className="text-sm font-semibold">
              {t("contact")}
            </h3>
            <LensTable
              prescription={prescription}
              product="contact"
              onUpdate={onUpdate}
              onUpdateEyes={onUpdateEyes}
              errorFor={errorFor}
              onTouched={onTouched}
            />
            <ContactDetails
              prescription={prescription}
              onUpdate={onUpdate}
              errorFor={errorFor}
              onTouched={onTouched}
            />
          </section>
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor={`${id}-note`}>{t("note")}</Label>
            <Textarea
              id={`${id}-note`}
              aria-describedby={`${id}-note-hint`}
              rows={3}
              value={response.note ?? ""}
              onChange={(event) => commit(prescription, event.target.value)}
            />
            <p id={`${id}-note-hint`} className="text-xs text-muted-foreground">
              {t("note_hint")}
            </p>
          </div>
          {clearControl}
          {questionnaireId && liveContext?.prescriber && (
            <PrescriptionHistory
              patientId={liveContext.patientId}
              userId={liveContext.prescriber.id}
            />
          )}
        </>
      )}
    </div>
  );
}
