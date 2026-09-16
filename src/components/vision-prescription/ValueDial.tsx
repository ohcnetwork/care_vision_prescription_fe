import { Minus, Plus } from "lucide-react";
import { type PointerEvent, useEffect, useRef, useState } from "react";

import { useTranslation } from "../../hooks/useTranslation";
import {
  type SuggestKind,
  dialSpec,
  snapValue,
  stepValue,
  suggestionLabel,
} from "../../lib/suggest";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

/**
 * The popup under a numeric field. It works as the dial on a phoropter.
 *
 * - Powers use a tape. Drag it, or scroll the wheel on it.
 * - The axis uses a protractor. Drag the handle on the arc.
 * - Fields with few usual values use a row of chips.
 *
 * The field keeps the keyboard focus. Every control here stops the pointer
 * from moving the focus, so the clinician can type at any time. The field
 * carries the accessible name and the arrow keys; the drawings are
 * decorative.
 */

export interface ValueDialProps {
  kind: SuggestKind;
  /** The stored number. A draft that is not a number shows as empty. */
  value: number | undefined;
  onChange: (value: number) => void;
  /** Called after a chip press, so the caller can close the popup. */
  onPick?: () => void;
}

/** Keeps the focus in the field when the clinician uses a pointer here. */
function keepFocus(event: PointerEvent) {
  event.preventDefault();
}

function unitFor(
  kind: SuggestKind,
): "unit_dioptre" | "unit_degree" | "unit_prism" | "unit_mm" | undefined {
  switch (kind) {
    case "dioptre":
    case "add":
      return "unit_dioptre";
    case "axis":
      return "unit_degree";
    case "prism":
      return "unit_prism";
    case "backCurve":
    case "diameter":
      return "unit_mm";
    default:
      return undefined;
  }
}

export function ValueDial({ kind, value, onChange, onPick }: ValueDialProps) {
  const { t } = useTranslation();
  const spec = dialSpec(kind);
  const unit = unitFor(kind);
  const step = (direction: 1 | -1, big: boolean) => {
    const next = stepValue(kind, value, direction, big);
    if (next !== undefined) onChange(next);
  };
  const usesChips =
    kind === "add" ||
    kind === "backCurve" ||
    kind === "diameter" ||
    kind === "duration";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          tabIndex={-1}
          aria-label={t("decrease")}
          onPointerDown={keepFocus}
          onClick={(event) => step(-1, event.shiftKey)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <div
          className="flex items-baseline gap-1 font-mono text-2xl tabular-nums"
          aria-live="polite"
        >
          <span className={cn(value === undefined && "text-muted-foreground")}>
            {value === undefined ? "—" : suggestionLabel(value, kind)}
          </span>
          {unit && (
            <span
              className={cn(
                "text-muted-foreground",
                unit === "unit_degree" ? "-ml-1 text-2xl" : "text-sm",
              )}
            >
              {t(unit)}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          tabIndex={-1}
          aria-label={t("increase")}
          onPointerDown={keepFocus}
          onClick={(event) => step(1, event.shiftKey)}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      {kind === "axis" ? (
        <AxisProtractor value={value} onChange={onChange} />
      ) : usesChips ? (
        <ValueChips
          kind={kind}
          value={value}
          onChange={(next) => {
            onChange(next);
            onPick?.();
          }}
        />
      ) : (
        <TapeScrubber kind={kind} value={value} onChange={onChange} />
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t("dial_keys_hint", {
          step: suggestionLabel(spec.step, kind).replace(/^\+/, ""),
          bigStep: suggestionLabel(spec.bigStep, kind).replace(/^\+/, ""),
        })}
      </p>
    </div>
  );
}

/** A short label for a tape mark: no trailing zeros, and 0 has no sign. */
function tapeLabel(value: number, kind: SuggestKind): string {
  if (value === 0) return "0";
  return suggestionLabel(value, kind).replace(/\.?0+$/, "");
}

const TAPE_WIDTH = 256;
const TAPE_HEIGHT = 56;
const PX_PER_STEP = 12;

/**
 * A tape with a mark at every step. The current value sits under the fixed
 * marker in the middle. Drag the tape to move it, as a tape measure moves
 * under a window. A click on a mark jumps to that value.
 */
function TapeScrubber({
  kind,
  value,
  onChange,
}: {
  kind: SuggestKind;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const spec = dialSpec(kind);
  const current = value ?? snapValue(kind, 0);
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    startX: number;
    startValue: number;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  // React registers wheel as passive, so the page would scroll too. A native
  // listener can stop that.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;
      if (delta === 0) return;
      const next = stepValue(kind, current, delta > 0 ? 1 : -1, event.shiftKey);
      if (next !== undefined) onChange(next);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [kind, current, onChange]);

  const valueAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return current;
    const offset = clientX - (rect.left + rect.width / 2);
    return snapValue(kind, current + (offset / PX_PER_STEP) * spec.step);
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    keepFocus(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startValue: current, moved: false };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    if (!state) return;
    const offset = state.startX - event.clientX;
    if (Math.abs(offset) > 2) state.moved = true;
    if (!state.moved) return;
    const next = snapValue(
      kind,
      state.startValue + (offset / PX_PER_STEP) * spec.step,
    );
    if (next !== current) onChange(next);
  };
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    drag.current = null;
    setDragging(false);
    if (state && !state.moved) {
      const next = valueAt(event.clientX);
      if (next !== current) onChange(next);
    }
  };

  // The marks in view. Steps outside the bounds stay blank.
  const half = Math.ceil(TAPE_WIDTH / 2 / PX_PER_STEP) + 1;
  const centreIndex = Math.round(current / spec.step);
  const marks: { x: number; value: number; major: boolean }[] = [];
  for (
    let index = centreIndex - half;
    index <= centreIndex + half;
    index += 1
  ) {
    const markValue = Number((index * spec.step).toFixed(spec.decimals));
    if (markValue < spec.min || markValue > spec.max) continue;
    const perBig = Math.round(spec.bigStep / spec.step);
    marks.push({
      x: TAPE_WIDTH / 2 + (index - current / spec.step) * PX_PER_STEP,
      value: markValue,
      major: index % perBig === 0,
    });
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${TAPE_WIDTH} ${TAPE_HEIGHT}`}
      width={TAPE_WIDTH}
      height={TAPE_HEIGHT}
      aria-hidden="true"
      className={cn(
        "vision-tape block w-full touch-none select-none",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <line
        x1={0}
        x2={TAPE_WIDTH}
        y1={30}
        y2={30}
        stroke="var(--strong-border)"
        strokeWidth={1}
      />
      {marks.map((mark) => (
        <g key={mark.value}>
          <line
            x1={mark.x}
            x2={mark.x}
            y1={30}
            y2={mark.major ? 14 : 22}
            stroke={
              mark.value === 0
                ? "var(--foreground)"
                : mark.major
                  ? "var(--muted-foreground)"
                  : "var(--strong-border)"
            }
            strokeWidth={mark.value === 0 ? 1.5 : 1}
          />
          {mark.major && mark.x > 14 && mark.x < TAPE_WIDTH - 14 && (
            <text
              x={mark.x}
              y={46}
              textAnchor="middle"
              fontSize={10}
              fill="var(--muted-foreground)"
              className="font-mono tabular-nums"
            >
              {tapeLabel(mark.value, kind)}
            </text>
          )}
        </g>
      ))}
      <g>
        <line
          x1={TAPE_WIDTH / 2}
          x2={TAPE_WIDTH / 2}
          y1={4}
          y2={34}
          stroke="var(--vision-axis)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <polygon
          points={`${TAPE_WIDTH / 2 - 5},0 ${TAPE_WIDTH / 2 + 5},0 ${TAPE_WIDTH / 2},6`}
          fill="var(--vision-axis)"
        />
      </g>
    </svg>
  );
}

const ARC_WIDTH = 280;
const ARC_HEIGHT = 146;
const ARC_CENTER = { x: ARC_WIDTH / 2, y: ARC_HEIGHT - 14 };
const ARC_RADIUS = 104;

function arcPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: ARC_CENTER.x + radius * Math.cos(radians),
    y: ARC_CENTER.y - radius * Math.sin(radians),
  };
}

/**
 * A half protractor in TABO form. 0 degrees is on the right, 90 at the top,
 * and 180 on the left. Drag the handle on the arc, or press a point on it.
 * Shift snaps to 5 degrees.
 */
function AxisProtractor({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);
  const current = value ?? 90;

  const angleAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return current;
    const scale = ARC_WIDTH / rect.width;
    const x = (event.clientX - rect.left) * scale - ARC_CENTER.x;
    const y = ARC_CENTER.y - (event.clientY - rect.top) * scale;
    let angle = (Math.atan2(y, x) * 180) / Math.PI;
    // A point under the base line snaps to the nearest end.
    if (angle < 0) angle = angle < -90 ? 180 : 0;
    const unit = event.shiftKey ? 5 : 1;
    return Math.min(180, Math.max(0, Math.round(angle / unit) * unit));
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    keepFocus(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const next = angleAt(event);
    if (next !== current) onChange(next);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const next = angleAt(event);
    if (next !== current) onChange(next);
  };
  const onPointerUp = () => setDragging(false);

  const handle = arcPoint(current, ARC_RADIUS);
  const inner = arcPoint(current + 180, 10);
  const start = arcPoint(0, ARC_RADIUS);
  const end = arcPoint(180, ARC_RADIUS);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${ARC_WIDTH} ${ARC_HEIGHT}`}
      width={ARC_WIDTH}
      height={ARC_HEIGHT}
      aria-hidden="true"
      className={cn(
        "vision-protractor block w-full touch-none select-none",
        dragging ? "cursor-grabbing" : "cursor-pointer",
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <path
        d={`M ${start.x} ${start.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 0 ${end.x} ${end.y}`}
        fill="var(--muted)"
        fillOpacity={0.5}
        stroke="var(--strong-border)"
        strokeWidth={1}
      />
      <line
        x1={end.x}
        x2={start.x}
        y1={ARC_CENTER.y}
        y2={ARC_CENTER.y}
        stroke="var(--strong-border)"
        strokeWidth={1}
      />
      {Array.from({ length: 37 }, (_, index) => index * 5).map((angle) => {
        const major = angle % 30 === 0;
        const medium = angle % 10 === 0;
        const outer = arcPoint(angle, ARC_RADIUS);
        const innerTick = arcPoint(
          angle,
          ARC_RADIUS - (major ? 12 : medium ? 8 : 4),
        );
        // The labels sit outside the arc, so the needle never hides them.
        const label = arcPoint(angle, ARC_RADIUS + 16);
        return (
          <g key={angle}>
            <line
              x1={outer.x}
              y1={outer.y}
              x2={innerTick.x}
              y2={innerTick.y}
              stroke={
                major ? "var(--muted-foreground)" : "var(--strong-border)"
              }
              strokeWidth={major ? 1.5 : 1}
            />
            {major && (
              <text
                x={label.x}
                y={label.y + 3.5}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
                className="font-mono tabular-nums"
              >
                {angle}
              </text>
            )}
          </g>
        );
      })}
      <line
        x1={inner.x}
        y1={inner.y}
        x2={handle.x}
        y2={handle.y}
        stroke="var(--vision-axis)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle
        cx={ARC_CENTER.x}
        cy={ARC_CENTER.y}
        r={3}
        fill="var(--vision-axis)"
      />
      <circle
        cx={handle.x}
        cy={handle.y}
        r={8}
        fill="var(--card)"
        stroke="var(--vision-axis)"
        strokeWidth={2.5}
      />
    </svg>
  );
}

/** The usual values as chips, for a field with a short list of them. */
function ValueChips({
  kind,
  value,
  onChange,
}: {
  kind: SuggestKind;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const spec = dialSpec(kind);
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {(spec.common ?? []).map((item) => (
        <Button
          key={item}
          type="button"
          variant={item === value ? "default" : "outline"}
          size="xs"
          tabIndex={-1}
          aria-pressed={item === value}
          className="min-w-12 font-mono tabular-nums"
          onPointerDown={keepFocus}
          onClick={() => onChange(item)}
        >
          {suggestionLabel(item, kind)}
        </Button>
      ))}
    </div>
  );
}
