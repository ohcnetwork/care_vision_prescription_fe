import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const CONTAINER = ".care-vision-prescription-fe";
const OPAQUE_AT_RULES = new Set([
  "keyframes",
  "-webkit-keyframes",
  "property",
  "font-face",
  "counter-style",
  "font-feature-values",
  "font-palette-values",
]);
const TOKENS = [
  "--background",
  "--foreground",
  "--card",
  "--popover",
  "--primary",
  "--muted-foreground",
  "--input",
  "--border",
  "--ring",
];

export function checkStyles(css) {
  const failures = [];
  const root = postcss.parse(css);
  const rootTokens = new Set();
  const palette = new Set();
  const modes = new Set();
  const utilities = new Set();
  root.walkAtRules("font-face", () => {
    failures.push("A global font-face rule is present.");
  });
  root.walkRules((rule) => {
    let parent = rule.parent;
    while (parent) {
      if (
        parent.type === "rule" ||
        (parent.type === "atrule" &&
          OPAQUE_AT_RULES.has(parent.name.toLowerCase()))
      ) {
        return;
      }
      parent = parent.parent;
    }
    selectorParser((selectors) => {
      selectors.each((selector) => {
        const text = selector.toString().trim();
        const scoped = selector.nodes.some(
          (node) => node.type === "class" && `.${node.value}` === CONTAINER,
        );
        if (!scoped) failures.push(`Unscoped selector: ${text}`);
        selector.walkClasses((node) => utilities.add(node.value));
        if (text === CONTAINER) {
          rule.walkDecls((declaration) => {
            rootTokens.add(declaration.prop);
            if (/^--color-/.test(declaration.prop)) {
              palette.add(declaration.prop);
            }
            if (
              declaration.prop === "font-family" &&
              declaration.value !== "inherit"
            ) {
              failures.push("The plug root overrides the host font.");
            }
          });
        }
        if (
          text === `.dark ${CONTAINER}` ||
          text === `${CONTAINER}.dark` ||
          text === `.high-contrast:not(.dark) ${CONTAINER}` ||
          text === `${CONTAINER}.high-contrast:not(.dark)` ||
          text === `[data-theme="protanopia"] ${CONTAINER}` ||
          text === `${CONTAINER}[data-theme="protanopia"]`
        ) {
          rule.walkDecls((declaration) => {
            if (
              TOKENS.includes(declaration.prop) ||
              declaration.prop === "--primary-500"
            ) {
              modes.add(text);
            }
          });
        }
      });
    }).processSync(rule.selector);
  });
  for (const token of TOKENS) {
    if (!rootTokens.has(token)) failures.push(`Missing scoped token: ${token}`);
  }
  for (const token of [
    "--color-white",
    "--color-neutral-950",
    "--color-emerald-500",
  ]) {
    if (!palette.has(token)) failures.push(`Missing Tailwind token: ${token}`);
  }
  for (const state of [
    `.dark ${CONTAINER}`,
    `${CONTAINER}.dark`,
    `.high-contrast:not(.dark) ${CONTAINER}`,
    `${CONTAINER}.high-contrast:not(.dark)`,
    `[data-theme="protanopia"] ${CONTAINER}`,
    `${CONTAINER}[data-theme="protanopia"]`,
  ]) {
    if (!modes.has(state))
      failures.push(`Missing scoped theme state: ${state}`);
  }
  for (const utility of [
    "bg-background",
    "bg-primary",
    "text-foreground",
    "text-muted-foreground",
    "border-input",
  ]) {
    if (!utilities.has(utility))
      failures.push(`Missing Care UI utility: ${utility}`);
  }
  return [...new Set(failures)];
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const assets = fileURLToPath(new URL("../dist/assets", import.meta.url));
  const cssFiles = readdirSync(assets).filter((name) => name.endsWith(".css"));
  if (cssFiles.length !== 1) {
    throw new Error(`Expected 1 CSS bundle. Found ${cssFiles.length}.`);
  }
  const failures = checkStyles(readFileSync(join(assets, cssFiles[0]), "utf8"));
  if (failures.length) {
    console.error("FAIL: the plug stylesheet is not isolated:");
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log(
    "OK: Care UI tokens, theme states, and utilities stay in the plug root.",
  );
}
