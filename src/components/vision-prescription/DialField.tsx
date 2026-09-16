import { Popover } from "@base-ui/react/popover";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { useTranslation } from "../../hooks/useTranslation";
import { usePortalContainer } from "../../lib/plug-root";
import { type NumericValue, parseNumericInput } from "../../lib/prescription";
import {
  type SuggestKind,
  stepValue,
  suggestionLabel,
} from "../../lib/suggest";
import { Input } from "../ui/input";
import { ValueDial } from "./ValueDial";

interface DialFieldProps {
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
 * A numeric field with a dial popup.
 *
 * The clinician types a value, or opens the dial with a click in the field or
 * with Alt + Down. The Up and Down keys move the value by one step, as a
 * phoropter dial does. Shift moves by a large step. The keys work with the
 * dial open or closed.
 *
 * The field keeps the focus while the dial is open. The dial closes on
 * Escape, on Tab, on a press outside, or on a chip press. `validate.ts` stays
 * the authority on what the form accepts.
 */
export function DialField({
  id,
  label,
  kind,
  value,
  onChange,
  onBlur,
  integer = false,
  placeholder,
  error,
}: DialFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  // Null means the clinician is not editing, so the field shows the stored
  // value in its canonical form instead of the raw keystrokes.
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const stored =
    typeof value === "number"
      ? suggestionLabel(value, kind)
      : value === undefined
        ? ""
        : String(value);
  const current = text ?? stored;
  const numeric = typeof value === "number" ? value : undefined;

  const setNumber = (next: number) => {
    setText(suggestionLabel(next, kind));
    onChange(next);
  };

  return (
    <div className="min-w-0">
      <Popover.Root
        open={open}
        modal={false}
        onOpenChange={(next, details) => {
          // The field is the anchor, not a trigger. A press on the field
          // must not count as a press outside.
          if (
            !next &&
            details.reason === "outside-press" &&
            details.event.target instanceof Node &&
            inputRef.current?.contains(details.event.target)
          ) {
            details.cancel();
            return;
          }
          setOpen(next);
        }}
      >
        <Input
          ref={inputRef}
          id={id}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={current}
          onChange={(event) => {
            setText(event.target.value);
            onChange(parseNumericInput(event.target.value));
          }}
          onClick={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              setOpen(false);
              return;
            }
            if (event.key === "Tab" && open) {
              // The portal puts focus guards after the field while the dial is
              // open. A synchronous close removes them before the browser
              // moves the focus, so Tab reaches the next field.
              flushSync(() => setOpen(false));
              return;
            }
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
            event.preventDefault();
            if (event.altKey) {
              setOpen(event.key === "ArrowDown");
              return;
            }
            const next = stepValue(
              kind,
              value,
              event.key === "ArrowUp" ? 1 : -1,
              event.shiftKey,
            );
            if (next !== undefined) setNumber(next);
          }}
          onBlur={() => {
            setOpen(false);
            setText(null);
            onBlur();
          }}
          className="h-9 min-w-20 px-2 text-right font-mono text-sm tabular-nums md:h-9 md:px-2"
        />
        <Popover.Portal container={usePortalContainer()}>
          <Popover.Positioner
            anchor={inputRef}
            side="bottom"
            align="end"
            sideOffset={6}
            className="isolate z-50"
          >
            <Popover.Popup
              initialFocus={false}
              finalFocus={false}
              aria-label={t("dial_label", { field: label })}
              className="vision-dial w-72 origin-(--transform-origin) rounded-md bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
            >
              <ValueDial
                kind={kind}
                value={numeric}
                onChange={setNumber}
                onPick={() => setOpen(false)}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <div className="vision-field-message" id={`${id}-error`}>
        {error}
      </div>
    </div>
  );
}
