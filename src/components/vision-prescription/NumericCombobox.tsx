import { useMemo, useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import { type NumericValue, parseNumericInput } from "../../lib/prescription";
import {
  type SuggestKind,
  suggestValues,
  suggestionLabel,
} from "../../lib/suggest";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "../ui/combobox";

interface NumericComboboxProps {
  id: string;
  label: string;
  kind: SuggestKind;
  value: NumericValue | undefined;
  onChange: (value: NumericValue | undefined) => void;
  onBlur: () => void;
  integer?: boolean;
  placeholder?: string;
  error?: string;
}

/**
 * A numeric field that offers the valid steps for what the clinician typed.
 *
 * The clinician can still type a value that the list does not hold. The list
 * speeds up the usual entry; `validate.ts` stays the authority on what the
 * form accepts.
 */
export function NumericCombobox({
  id,
  label,
  kind,
  value,
  onChange,
  onBlur,
  integer = false,
  placeholder,
  error,
}: NumericComboboxProps) {
  const { t } = useTranslation();
  // Null means the clinician is not editing, so the field shows the stored
  // value in its canonical form instead of the raw keystrokes.
  const [text, setText] = useState<string | null>(null);
  // The field shows a stored number in the same form as the list, so the value
  // that the clinician picks reads back the same way.
  const stored =
    typeof value === "number"
      ? suggestionLabel(value, kind)
      : value === undefined
        ? ""
        : String(value);
  const current = text ?? stored;
  const items = useMemo(() => suggestValues(kind, current), [kind, current]);

  return (
    <div className="min-w-0">
      <Combobox
        items={items}
        value={typeof value === "number" ? value : null}
        filter={null}
        itemToStringLabel={(item: number) => suggestionLabel(item, kind)}
        onValueChange={(picked: number | null) => {
          if (picked === null) return;
          setText(suggestionLabel(picked, kind));
          onChange(picked);
        }}
        inputValue={current}
        onInputValueChange={(next: string) => {
          setText(next);
          onChange(parseNumericInput(next));
        }}
      >
        <ComboboxInput
          id={id}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          // The list opens when the field gets a click or a keystroke. A
          // chevron button would take the space that a value such as -20.00
          // needs.
          showTrigger={false}
          onBlur={() => {
            setText(null);
            onBlur();
          }}
          className="h-9 w-full min-w-20 [&_input]:px-2 [&_input]:text-right [&_input]:font-mono [&_input]:text-sm [&_input]:tabular-nums"
        >
          <ComboboxContent className="max-h-64">
            <ComboboxEmpty>{t("no_suggestions")}</ComboboxEmpty>
            <ComboboxList>
              <ComboboxCollection>
                {(item: number) => (
                  <ComboboxItem
                    key={item}
                    value={item}
                    className="justify-end font-mono tabular-nums"
                  >
                    {suggestionLabel(item, kind)}
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxList>
          </ComboboxContent>
        </ComboboxInput>
      </Combobox>
      <div className="vision-field-message" id={`${id}-error`}>
        {error}
      </div>
    </div>
  );
}
