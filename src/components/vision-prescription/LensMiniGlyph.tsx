import { isFiniteNumber, powerCross } from "../../lib/optics";
import {
  type Eye,
  type LensSpecification,
  type PrismBase,
  type Product,
  getPrism,
} from "../../lib/prescription";

/**
 * A small lens, drawn as the clinician sees it on a trial frame.
 *
 * The circle is the lens. 0 degrees is on the right for both eyes (TABO).
 * The solid line is the cylinder axis. The dashed line is the meridian 90
 * degrees from it. An arrow points to the prism base. A shaded segment at the
 * bottom marks the Add.
 *
 * The drawing has no text and is decorative. The fields and the Rx line
 * carry the data, so the SVG stays hidden from assistive technology.
 */

const SIZE = 56;
const CENTER = SIZE / 2;
const RADIUS = 24;
const PRISM_LENGTH = 15;

interface Point {
  x: number;
  y: number;
}

/** A point at `radius` from the centre, at a TABO angle in degrees. */
function polar(angle: number, radius: number): Point {
  const radians = (angle * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER - radius * Math.sin(radians),
  };
}

function format(point: Point): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

/**
 * The unit direction of a prism base. "In" points to the nose. The right eye
 * sits on the left of a prescription, so its nose is on its right.
 */
function baseDirection(base: PrismBase, eye: Eye): Point {
  switch (base) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "in":
      return { x: eye === "right" ? 1 : -1, y: 0 };
    case "out":
      return { x: eye === "right" ? -1 : 1, y: 0 };
  }
}

function Meridian({ angle, dashed }: { angle: number; dashed?: boolean }) {
  const from = polar(angle, RADIUS);
  const to = polar(angle + 180, RADIUS);
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke="var(--vision-axis)"
      strokeWidth={dashed ? 1 : 2}
      strokeDasharray={dashed ? "2 2" : undefined}
      strokeLinecap="round"
    />
  );
}

export interface LensMiniGlyphProps {
  lens: LensSpecification | undefined;
  product: Product;
  eye: Eye;
}

export function LensMiniGlyph({ lens, product, eye }: LensMiniGlyphProps) {
  const cross = powerCross(lens, product);
  const empty = !lens;
  const prisms = lens
    ? (["horizontal", "vertical"] as const)
        .map((plane) => getPrism(lens, plane))
        .filter(
          (prism): prism is { amount: number; base: PrismBase } =>
            !!prism && !!prism.base && isFiniteNumber(prism.amount),
        )
    : [];
  const hasAdd = !!lens && isFiniteNumber(lens.add);
  const segmentY = CENTER + RADIUS * 0.45;
  const segmentHalf = Math.sqrt(RADIUS ** 2 - (segmentY - CENTER) ** 2);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE}
      height={SIZE}
      aria-hidden="true"
      focusable="false"
      className="vision-mini-glyph shrink-0"
    >
      {/* Marks at 0, 90, and 180 degrees. */}
      {[0, 90, 180].map((angle) => {
        const from = polar(angle, RADIUS + 1.5);
        const to = polar(angle, RADIUS + 4);
        return (
          <line
            key={angle}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="var(--muted-foreground)"
            strokeOpacity={0.6}
            strokeWidth={1}
          />
        );
      })}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="var(--muted)"
        fillOpacity={empty ? 0.25 : 0.6}
        stroke="var(--strong-border)"
        strokeWidth={1.25}
        strokeDasharray={empty ? "3 2" : undefined}
      />
      {cross && (
        <g>
          <Meridian angle={cross.axis + 90} dashed />
          <Meridian angle={cross.axis} />
        </g>
      )}
      {hasAdd && (
        <path
          d={`M ${format({ x: CENTER - segmentHalf, y: segmentY })} A ${RADIUS} ${RADIUS} 0 0 0 ${format({ x: CENTER + segmentHalf, y: segmentY })} Z`}
          fill="var(--vision-axis)"
          fillOpacity={0.18}
          stroke="var(--vision-axis)"
          strokeWidth={1}
        />
      )}
      {prisms.map((prism) => {
        const direction = baseDirection(prism.base, eye);
        const tip = {
          x: CENTER + direction.x * PRISM_LENGTH,
          y: CENTER + direction.y * PRISM_LENGTH,
        };
        const back = { x: tip.x - direction.x * 5, y: tip.y - direction.y * 5 };
        const side = { x: -direction.y * 3, y: direction.x * 3 };
        return (
          <g key={prism.base}>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={back.x}
              y2={back.y}
              stroke="var(--vision-prism)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <polygon
              points={`${format(tip)} ${format({ x: back.x + side.x, y: back.y + side.y })} ${format({ x: back.x - side.x, y: back.y - side.y })}`}
              fill="var(--vision-prism)"
            />
          </g>
        );
      })}
    </svg>
  );
}
