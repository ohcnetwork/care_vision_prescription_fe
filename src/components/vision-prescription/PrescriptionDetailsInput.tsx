import { useId } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { STATUSES } from "../../lib/constants";
import { fieldValue, groupUpdates } from "../../lib/group";
import { PLUG_ROOT_CLASS } from "../../lib/plug-root";
import { localDate } from "../../lib/prescription";
import type { GroupInputProps } from "../../types/host";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { NativeSelect, NativeSelectOption } from "../ui/native-select";

export default function PrescriptionDetailsInput({
  fields,
  onChange,
  disabled,
  question,
}: GroupInputProps) {
  const { t } = useTranslation();
  const id = useId();
  const locked = disabled || question.read_only;
  return (
    <div className={`${PLUG_ROOT_CLASS} grid gap-4 sm:grid-cols-2`}>
      {(["status", "dateWritten"] as const).map((key) => {
        const field = fields[key];
        if (!field || field.hidden) return null;
        const value = String(fieldValue(fields, key) ?? "");
        const date = field.response.values[0]?.value;
        const localDateTime =
          date instanceof Date && Number.isFinite(date.getTime())
            ? `${localDate(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
            : "";
        const readOnly = locked || field.disabled;
        const error = field.errors[0]?.msg ?? field.errors[0]?.error;
        const change = (next: string) =>
          onChange(
            groupUpdates({ [key]: field }, { [key]: next || undefined }),
          );
        return (
          <div key={key} className="space-y-2">
            <Label htmlFor={`${id}-${key}`}>{t(key)}</Label>
            {readOnly ? (
              <p>
                {key === "status" && value
                  ? STATUSES.includes(value as (typeof STATUSES)[number])
                    ? t(value as (typeof STATUSES)[number])
                    : value
                  : value || t("not_recorded")}
              </p>
            ) : key === "status" ? (
              <NativeSelect
                id={`${id}-${key}`}
                value={value}
                aria-invalid={!!error}
                onChange={(event) => change(event.target.value)}
              >
                <NativeSelectOption value="">
                  {t("not_recorded")}
                </NativeSelectOption>
                {field.question.answer_option?.map(({ value }) => (
                  <NativeSelectOption key={value} value={value}>
                    {STATUSES.includes(value as (typeof STATUSES)[number])
                      ? t(value as (typeof STATUSES)[number])
                      : value}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <Input
                id={`${id}-${key}`}
                type="datetime-local"
                value={localDateTime}
                aria-invalid={!!error}
                onChange={(event) => change(event.target.value)}
              />
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
