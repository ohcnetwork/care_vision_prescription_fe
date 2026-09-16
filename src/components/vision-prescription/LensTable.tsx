import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  CopyPlus,
} from "lucide-react";
import { useId, useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { EYES } from "../../lib/constants";
import { formatRxLine } from "../../lib/notation";
import {
  canTranspose,
  formatTransposed,
  getClinicalHints,
  transposeLens,
} from "../../lib/optics";
import {
  type Eye,
  type LensSpecification,
  type NumericField,
  type Product,
  type VisionPrescription,
  getLens,
  getPrism,
  hasLensValues,
  newLens,
  setLensField,
} from "../../lib/prescription";
import { kindForField } from "../../lib/suggest";
import { fieldKey } from "../../lib/validate";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DialField } from "./DialField";
import { LensMiniGlyph } from "./LensMiniGlyph";
import { PrismFields } from "./PrismFields";

export interface LensTableProps {
  prescription: VisionPrescription;
  product: Product;
  onUpdate: (
    product: Product,
    eye: Eye,
    update: (lens: LensSpecification) => LensSpecification,
  ) => void;
  /** Changes both eyes in 1 step, so the host receives 1 value. */
  onUpdateEyes: (
    product: Product,
    update: (lens: LensSpecification, eye: Eye) => LensSpecification,
  ) => void;
  errorFor: (key: string) => string | undefined;
  onTouched: (key: string) => void;
}

// The fields that both lens types share. Each one needs a `<field>_unit` label
// and a `placeholder_<field>` hint.
type OpticalField = Extract<
  NumericField,
  "sphere" | "power" | "cylinder" | "axis" | "add"
>;

function hasPrismValues(
  prescription: VisionPrescription,
  product: Product,
): boolean {
  return EYES.some((eye) => {
    const lens = getLens(prescription, product, eye);
    if (!lens) return false;
    return !!getPrism(lens, "horizontal") || !!getPrism(lens, "vertical");
  });
}

export function LensTable({
  prescription,
  product,
  onUpdate,
  onUpdateEyes,
  errorFor,
  onTouched,
}: LensTableProps) {
  const { t } = useTranslation();
  const id = useId();
  const primary: OpticalField = product === "lens" ? "sphere" : "power";
  const fields: OpticalField[] = [primary, "cylinder", "axis", "add"];

  // Null means the clinician did not use the control yet. The fields then open
  // only if the prescription already has a prism, which keeps saved data in
  // view.
  const [prismToggled, setPrismToggled] = useState<boolean | null>(null);
  const prismHasValues = hasPrismValues(prescription, product);
  const showPrism = prismToggled ?? prismHasValues;

  const right = getLens(prescription, product, "right");
  const left = getLens(prescription, product, "left");
  const canCopy =
    !!right && hasLensValues(right) && !(left && hasLensValues(left));
  const canTransposeAny =
    canTranspose(right, product) || canTranspose(left, product);
  const hints = getClinicalHints(prescription, product);

  return (
    <div className="space-y-3">
      <Table aria-label={t(product)} className="vision-optical-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-2/5">{t("eye")}</TableHead>
            {fields.map((field) => (
              <TableHead key={field} className="text-right">
                {t(`${field}_unit`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {EYES.map((eye) => {
            const lens =
              getLens(prescription, product, eye) ?? newLens(product, eye);
            const label = (field: string) =>
              t("field_label", { product: t(product), eye: t(eye), field });
            const update = (
              change: (value: LensSpecification) => LensSpecification,
            ) => onUpdate(product, eye, change);
            return (
              <TableRow key={eye}>
                <TableHead scope="row" className="align-top font-normal">
                  {/* The glyph is as tall as the row already is. The 3 text
                      lines beside it fit in that height, so the cell adds
                      none. */}
                  <div className="flex items-center gap-3">
                    <LensMiniGlyph
                      lens={getLens(prescription, product, eye)}
                      product={product}
                      eye={eye}
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-medium text-foreground">
                          {t(eye)}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {t(`${eye}_short`)}
                        </span>
                      </div>
                      {/* The line repeats the row in the notation that a
                          clinician reads on a prescription. The second line
                          shows the same lens in the other cylinder form. */}
                      <span
                        className="block font-mono text-xs whitespace-pre-wrap text-muted-foreground"
                        aria-live="polite"
                      >
                        {formatRxLine(lens, product)}
                      </span>
                      {formatTransposed(lens, product) && (
                        <span className="block font-mono text-xs whitespace-pre-wrap text-muted-foreground/70">
                          {t("other_form")}: {formatTransposed(lens, product)}
                        </span>
                      )}
                    </div>
                  </div>
                </TableHead>
                {fields.map((field) => {
                  const key = fieldKey(product, eye, field);
                  return (
                    <TableCell key={field} className="align-top">
                      <DialField
                        id={`${id}-${eye}-${field}`}
                        label={label(t(`${field}_unit`))}
                        kind={kindForField(field)}
                        value={lens[field]}
                        integer={field === "axis"}
                        placeholder={t(`placeholder_${field}`)}
                        onChange={(value) =>
                          update((current) =>
                            setLensField(current, field, value),
                          )
                        }
                        onBlur={() => onTouched(key)}
                        error={errorFor(key)}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canCopy}
          title={canCopy ? undefined : t("copy_eye_hint")}
          onClick={() =>
            right &&
            onUpdate(product, "left", () => ({ ...right, eye: "left" }))
          }
        >
          <CopyPlus className="size-3.5" aria-hidden="true" />
          {t("copy_eye")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canTransposeAny}
          title={canTransposeAny ? undefined : t("transpose_hint")}
          onClick={() =>
            onUpdateEyes(product, (lens) => transposeLens(lens, product))
          }
        >
          <ArrowLeftRight className="size-3.5" aria-hidden="true" />
          {t("transpose")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={showPrism}
          // The clinician cannot hide a prism that has a value. Hidden data is
          // unsafe on a prescription.
          disabled={showPrism && prismHasValues}
          title={showPrism && prismHasValues ? t("prism_keep_hint") : undefined}
          onClick={() => setPrismToggled(!showPrism)}
        >
          {showPrism ? (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          )}
          {t("prism")}
        </Button>
      </div>

      {hints.length > 0 && (
        <ul
          role="status"
          aria-label={t("hints")}
          className="vision-hints space-y-1 text-xs text-amber-700 dark:text-amber-400"
        >
          {hints.map((hint) => (
            <li key={`${hint.message}-${hint.eye ?? ""}`}>
              {t(hint.message, {
                ...hint.values,
                eye: hint.eye ? t(hint.eye) : "",
              })}
            </li>
          ))}
        </ul>
      )}

      {showPrism && (
        <PrismFields
          prescription={prescription}
          product={product}
          onUpdate={onUpdate}
          errorFor={errorFor}
          onTouched={onTouched}
        />
      )}
    </div>
  );
}
