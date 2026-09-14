import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Pass care_dental_fe/src/style/index.css as the source.");
}
const source = readFileSync(sourcePath, "utf8");
const boundary = source.indexOf("/* \u2500\u2500 Dental finding tokens");
if (boundary < 0 || !source.includes("Snapshot of careui@0dda891")) {
  throw new Error("The reference theme changed. Inspect it before import.");
}
let theme = source.slice(0, boundary);
theme = theme
  .replace(
    /^\/\*[\s\S]*?\*\//,
    `/*
 * Care UI theme, snapshot 0dda891, from care_dental_fe at
 * b582ec644ecf3986c6de73a2f0a3ab2e69edc7ae.
 * Source: https://github.com/ohcnetwork/careui/blob/0dda891/src/index.css
 * Keep the Care UI tokens. Omit font imports and inherit the host font.
 * The Vite post-build pass scopes this sheet to .care-vision-prescription-fe.
 */`,
  )
  .replaceAll("care-dental-fe", "care-vision-prescription-fe")
  .replace(
    /\/\* Retargeted from upstream[\s\S]*?type\. \*\//,
    "/* Keep base styles inside the plug root. */",
  )
  .replaceAll("\u2500", "-")
  .replaceAll("\u2014", "-")
  .replaceAll("\u2013", "-")
  .replaceAll("\u2019", "'");
theme = `${theme.trim()}\n
@layer base {
  input[inputmode="decimal"],
  input[inputmode="numeric"],
  input[type="number"] {
    @apply font-mono tabular-nums;
  }
}
`;

if (existsSync("src/style/index.css")) {
  throw new Error("Preserve the existing src/style/index.css.");
}
mkdirSync("src/style", { recursive: true });
writeFileSync("src/style/index.css", theme, { flag: "wx" });
writeFileSync(
  "scripts/theme-provenance.json",
  JSON.stringify(
    {
      source: "care_dental_fe/src/style/index.css",
      revision: "b582ec644ecf3986c6de73a2f0a3ab2e69edc7ae",
      careUiRevision: "0dda891",
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      changes: [
        "Keep only the Care UI theme before the dental finding tokens.",
        "Retarget the container and retain the host font.",
        "Use monospace for numeric inputs.",
      ],
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log("Vendored Care UI tokens into src/style/index.css.");
