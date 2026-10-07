import { useId, useRef, useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { EYES, PRODUCTS } from "../../lib/constants";
import {
  fieldValue,
  groupKey,
  groupUnavailable,
  readGroupPrescription,
  updatePrescriptionRows,
} from "../../lib/group";
import { PLUG_ROOT_CLASS } from "../../lib/plug-root";
import {
  type Eye,
  type LensSpecification,
  type Product,
  type VisionPrescription,
  getLens,
  newPrescription,
  updateLens,
} from "../../lib/prescription";
import "../../style/index.css";
import type { GroupInputProps } from "../../types/host";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ContactDetails } from "./ContactDetails";
import { LensTable } from "./LensTable";
import { PrescriptionSummary } from "./PrescriptionSummary";
import "./prescription.css";

export default function VisionPrescriptionInput(props: GroupInputProps) {
  const { question, fields, rows, disabled } = props;
  const { t } = useTranslation();
  const id = useId();
  const [empty] = useState(newPrescription);
  const stored = readGroupPrescription(rows);
  const prescription = stored.kind === "value" ? stored.prescription : empty;
  const [confirmClear, setConfirmClear] = useState(false);
  const unavailable =
    groupUnavailable(fields, disabled) ||
    rows.some((row) => groupUnavailable(row.fields, disabled));
  const readOnly = disabled || !!question.read_only || unavailable;
  const latest = useRef(prescription);
  latest.current = prescription;
  const errorFor = (key: string) => {
    const [product, eye, ...path] = key.split(".");
    const binding = path.length
      ? rows.find(
          (row) =>
            fieldValue(row.fields, "product") === product &&
            fieldValue(row.fields, "eye") === eye,
        )?.fields[groupKey(path.join("."))]
      : undefined;
    const error = binding?.errors[0];
    return error?.msg ?? error?.error;
  };
  const onTouched = () => {};
  const commit = (next: VisionPrescription) => {
    if (readOnly) return;
    latest.current = next;
    updatePrescriptionRows(props, next);
  };
  const onUpdate = (
    product: Product,
    eye: Eye,
    update: (lens: LensSpecification) => LensSpecification,
  ) => commit(updateLens(latest.current, product, eye, update));
  const onUpdateEyes = (
    product: Product,
    update: (lens: LensSpecification, eye: Eye) => LensSpecification,
  ) =>
    commit(
      EYES.reduce(
        (current, eye) =>
          updateLens(current, product, eye, (lens) => update(lens, eye)),
        latest.current,
      ),
    );

  const clear = () => {
    if (readOnly) return;
    updatePrescriptionRows(props);
    setConfirmClear(false);
  };

  const clearControl = (
    <div className="vision-controls space-y-2">
      <Button
        type="button"
        variant="ghost"
        disabled={stored.kind === "empty"}
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

  if (!question.repeats)
    throw new Error("Vision prescription requires repeating rows");

  return (
    <div
      className={`${PLUG_ROOT_CLASS} vision-question min-w-0 space-y-4 rounded-lg border bg-card p-4 text-card-foreground`}
    >
      {unavailable && !disabled && <p role="alert">{t("group_unavailable")}</p>}
      {stored.kind === "invalid" ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {t("error_answer")}
          </p>
          {!readOnly && clearControl}
        </div>
      ) : readOnly ? (
        stored.kind === "value" ? (
          <PrescriptionSummary prescription={prescription} showStatus={false} />
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty_answer")}</p>
        )
      ) : (
        <>
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
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            {PRODUCTS.flatMap((product) =>
              EYES.map((eye) => {
                const lens = getLens(prescription, product, eye);
                const noteId = `${id}-${product}-${eye}-note`;
                return (
                  <div key={noteId} className="space-y-2">
                    <Label htmlFor={noteId}>
                      {t("field_label", {
                        product: t(product),
                        eye: t(eye),
                        field: t("note"),
                      })}
                    </Label>
                    <Textarea
                      id={noteId}
                      rows={2}
                      value={lens?.note?.[0]?.text ?? ""}
                      onChange={(event) =>
                        onUpdate(product, eye, (current) => ({
                          ...current,
                          note: event.target.value
                            ? [{ text: event.target.value }]
                            : undefined,
                        }))
                      }
                    />
                  </div>
                );
              }),
            )}
          </div>
          {clearControl}
        </>
      )}
    </div>
  );
}
