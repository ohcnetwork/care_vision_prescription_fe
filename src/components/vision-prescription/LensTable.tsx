import { ChevronDown, ChevronRight, CopyPlus } from "lucide-react";
import { useId, useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { EYES } from "../../lib/constants";
import { formatRxLine } from "../../lib/notation";
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
import { NumericCombobox } from "./NumericCombobox";
import { PrismFields } from "./PrismFields";

export interface LensTableProps {
  prescription: VisionPrescription;
  product: Product;
  onUpdate: (
    product: Product,
    eye: Eye,
    update: (lens: LensSpecification) => LensSpecification,
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

  return (
    <div className="space-y-3">
      <Table aria-label={t(product)} className="vision-optical-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">{t("eye")}</TableHead>
            {fields.map((field) => (
              <TableHead key={field} className="w-24 text-right">
                {t(`${field}_unit`)}
              </TableHead>
            ))}
            <TableHead>{t("reads_as")}</TableHead>
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
                <TableHead scope="row" className="pt-4 align-top">
                  <span className="block text-foreground">{t(eye)}</span>
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {t(`${eye}_short`)}
                  </span>
                </TableHead>
                {fields.map((field) => {
                  const key = fieldKey(product, eye, field);
                  return (
                    <TableCell key={field} className="align-top">
                      <NumericCombobox
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
                <TableCell className="pt-4 align-top">
                  {/* The line repeats the row in the notation that a clinician
                      reads on a prescription. It shows a transposed value at a
                      glance. */}
                  <span
                    className="font-mono text-xs whitespace-pre-wrap text-muted-foreground"
                    aria-live="polite"
                  >
                    {formatRxLine(lens, product)}
                  </span>
                </TableCell>
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
