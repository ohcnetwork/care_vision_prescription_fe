import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { DURATION_LABELS, DURATION_UNITS, EYES } from "../../lib/constants";
import {
  type VisionPrescription,
  getLens,
  newLens,
  setDuration,
  setLensField,
} from "../../lib/prescription";
import { kindForField } from "../../lib/suggest";
import { fieldKey } from "../../lib/validate";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import type { LensTableProps } from "./LensTable";
import { NumericCombobox } from "./NumericCombobox";

const DETAIL_FIELDS = ["backCurve", "diameter", "color", "brand"] as const;

function hasDetailValues(prescription: VisionPrescription): boolean {
  return EYES.some((eye) => {
    const lens = getLens(prescription, "contact", eye);
    if (!lens) return false;
    if (lens.duration) return true;
    return DETAIL_FIELDS.some(
      (field) => lens[field] !== undefined && lens[field] !== "",
    );
  });
}

export function ContactDetails({
  prescription,
  onUpdate,
  errorFor,
  onTouched,
}: Omit<LensTableProps, "product">) {
  const { t } = useTranslation();
  const id = useId();

  // Null means the clinician did not use the control yet. The fields then open
  // only if the prescription already has a fit value, which keeps saved data
  // in view.
  const [toggled, setToggled] = useState<boolean | null>(null);
  const hasValues = hasDetailValues(prescription);
  const show = toggled ?? hasValues;

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={show}
        // The clinician cannot hide a fit value. Hidden data is unsafe on a
        // prescription.
        disabled={show && hasValues}
        title={show && hasValues ? t("contact_keep_hint") : undefined}
        onClick={() => setToggled(!show)}
      >
        {show ? (
          <ChevronDown className="size-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3.5" aria-hidden="true" />
        )}
        {t("contact_details")}
      </Button>

      {show && (
        <DetailTable
          id={id}
          prescription={prescription}
          onUpdate={onUpdate}
          errorFor={errorFor}
          onTouched={onTouched}
        />
      )}
    </div>
  );
}

function DetailTable({
  id,
  prescription,
  onUpdate,
  errorFor,
  onTouched,
}: Omit<LensTableProps, "product"> & { id: string }) {
  const { t } = useTranslation();

  return (
    <Table aria-label={t("contact_details")} className="vision-contact-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">{t("eye")}</TableHead>
          <TableHead className="w-32 text-right">
            {t("back_curve_unit")}
          </TableHead>
          <TableHead className="w-32 text-right">
            {t("diameter_unit")}
          </TableHead>
          <TableHead className="w-56">{t("duration")}</TableHead>
          <TableHead>{t("color")}</TableHead>
          <TableHead>{t("brand")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {EYES.map((eye) => {
          const lens =
            getLens(prescription, "contact", eye) ?? newLens("contact", eye);
          const label = (field: string) =>
            t("field_label", { product: t("contact"), eye: t(eye), field });
          const durationKey = fieldKey("contact", eye, "duration");
          return (
            <TableRow key={eye}>
              <TableHead scope="row" className="pt-4 align-top">
                <span className="block text-foreground">{t(eye)}</span>
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {t(`${eye}_short`)}
                </span>
              </TableHead>
              {(["backCurve", "diameter"] as const).map((field) => {
                const key = fieldKey("contact", eye, field);
                return (
                  <TableCell key={field} className="align-top">
                    <NumericCombobox
                      id={`${id}-${eye}-${field}`}
                      label={label(
                        t(
                          field === "backCurve"
                            ? "back_curve_unit"
                            : "diameter_unit",
                        ),
                      )}
                      kind={kindForField(field)}
                      placeholder={t(
                        field === "backCurve"
                          ? "placeholder_back_curve"
                          : "placeholder_diameter",
                      )}
                      value={lens[field]}
                      onChange={(value) =>
                        onUpdate("contact", eye, (current) =>
                          setLensField(current, field, value),
                        )
                      }
                      onBlur={() => onTouched(key)}
                      error={errorFor(key)}
                    />
                  </TableCell>
                );
              })}
              <TableCell className="align-top">
                <div className="flex gap-1">
                  <div className="w-24">
                    <NumericCombobox
                      id={`${id}-${eye}-duration`}
                      label={label(t("duration"))}
                      kind="duration"
                      integer
                      placeholder={t("placeholder_duration")}
                      value={lens.duration?.value}
                      onChange={(value) =>
                        onUpdate("contact", eye, (current) =>
                          setDuration(current, value, current.duration?.code),
                        )
                      }
                      onBlur={() => onTouched(durationKey)}
                      error={errorFor(durationKey)}
                    />
                  </div>
                  <NativeSelect
                    aria-label={label(t("duration_unit"))}
                    value={lens.duration?.code ?? ""}
                    className="h-9"
                    onChange={(event) => {
                      const code = DURATION_UNITS.find(
                        (unit) => unit === event.target.value,
                      );
                      onUpdate("contact", eye, (current) =>
                        setDuration(current, current.duration?.value, code),
                      );
                      onTouched(durationKey);
                    }}
                  >
                    <NativeSelectOption value="">
                      {t("select_unit")}
                    </NativeSelectOption>
                    {DURATION_UNITS.map((unit) => (
                      <NativeSelectOption key={unit} value={unit}>
                        {t(DURATION_LABELS[unit])}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              </TableCell>
              {(["color", "brand"] as const).map((field) => (
                <TableCell key={field} className="align-top">
                  <Input
                    aria-label={label(t(field))}
                    value={lens[field] ?? ""}
                    autoComplete="off"
                    placeholder={
                      field === "color" ? t("placeholder_color") : undefined
                    }
                    className="h-9 min-w-28 text-sm"
                    onChange={(event) =>
                      onUpdate("contact", eye, (current) =>
                        setLensField(
                          current,
                          field,
                          event.target.value || undefined,
                        ),
                      )
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
