import { X } from "lucide-react";
import { useId } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { EYES, PRISM_BASES } from "../../lib/constants";
import {
  type Eye,
  type LensSpecification,
  type PrismPlane,
  type Product,
  type VisionPrescription,
  getLens,
  getPrism,
  newLens,
  setPrism,
} from "../../lib/prescription";
import { fieldKey } from "../../lib/validate";
import { Button } from "../ui/button";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DialField } from "./DialField";

export interface PrismFieldsProps {
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

type PrismBaseValue = (typeof PRISM_BASES)[number];

const BASES: Record<PrismPlane, readonly PrismBaseValue[]> = {
  horizontal: ["in", "out"],
  vertical: ["up", "down"],
};

/**
 * The prism fields for both eyes.
 *
 * A clinician prescribes a prism for a small number of patients only. The
 * fields stay in a table of their own, which the clinician opens when the
 * patient needs a prism. This keeps the main table narrow.
 */
export function PrismFields({
  prescription,
  product,
  onUpdate,
  errorFor,
  onTouched,
}: PrismFieldsProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <Table aria-label={t("prism_for", { product: t(product) })}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20">{t("eye")}</TableHead>
          <TableHead>{t("prism_horizontal")}</TableHead>
          <TableHead>{t("prism_vertical")}</TableHead>
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
              {(["horizontal", "vertical"] as const).map(
                (plane: PrismPlane) => {
                  const prism = getPrism(lens, plane);
                  const amountKey = fieldKey(
                    product,
                    eye,
                    `prism.${plane}.amount`,
                  );
                  const baseKey = fieldKey(product, eye, `prism.${plane}.base`);
                  const baseError = errorFor(baseKey);
                  const baseId = `${id}-${eye}-${plane}-base`;
                  return (
                    <TableCell key={plane} className="align-top">
                      <div className="flex max-w-xs items-start gap-1">
                        <div className="w-24 shrink-0">
                          <DialField
                            id={`${id}-${eye}-${plane}-amount`}
                            label={label(
                              `${t(`prism_${plane}`)} ${t("prism_amount")}`,
                            )}
                            kind="prism"
                            placeholder={t("placeholder_prism")}
                            value={prism?.amount}
                            onChange={(amount) =>
                              update((current) =>
                                setPrism(current, plane, { amount }),
                              )
                            }
                            onBlur={() => onTouched(amountKey)}
                            error={errorFor(amountKey)}
                          />
                        </div>
                        <div className="min-w-24 flex-1">
                          <NativeSelect
                            id={baseId}
                            aria-label={label(
                              `${t(`prism_${plane}`)} ${t("prism_base")}`,
                            )}
                            aria-invalid={!!baseError}
                            aria-describedby={
                              baseError ? `${baseId}-error` : undefined
                            }
                            value={prism?.base ?? ""}
                            onChange={(event) => {
                              const base = PRISM_BASES.find(
                                (value) => value === event.target.value,
                              );
                              update((current) =>
                                setPrism(current, plane, { base }),
                              );
                              onTouched(baseKey);
                            }}
                            className="h-9 w-full text-sm"
                          >
                            <NativeSelectOption value="">
                              {t("select_base")}
                            </NativeSelectOption>
                            {BASES[plane].map((base) => (
                              <NativeSelectOption key={base} value={base}>
                                {t(base)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                          <div
                            id={`${baseId}-error`}
                            className="vision-field-message"
                          >
                            {baseError}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          // The button keeps its space when there is nothing to
                          // clear. The row does not move when a value arrives.
                          className={`h-9 w-7 shrink-0 ${prism ? "" : "invisible"}`}
                          aria-hidden={prism ? undefined : true}
                          tabIndex={prism ? undefined : -1}
                          aria-label={t("clear_prism", {
                            plane: t(plane),
                            eye: t(eye),
                          })}
                          onClick={() =>
                            update((current) =>
                              setPrism(current, plane, {
                                amount: undefined,
                                base: undefined,
                              }),
                            )
                          }
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  );
                },
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
