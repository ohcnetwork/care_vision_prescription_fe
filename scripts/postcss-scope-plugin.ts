/**
 * Adapted from care_dental_fe/scripts/postcss-scope-plugin.ts.
 * Scope after Tailwind generates CSS. css.postcss cannot see that output.
 */
import type { AtRule, Plugin as PostcssPlugin, Root, Rule } from "postcss";
import selectorParser from "postcss-selector-parser";
import type { Plugin } from "vite";

export const CONTAINER = ".care-vision-prescription-fe";
const ROOT_LIKE = /^(?::root|:host(?:\([^)]*\))?|html|body)$/;
const THEME_STATE =
  /^(?:\.dark|\.high-contrast|\[data-theme=[^\]]*\]|:not\([^)]*\))+$/;
const OPAQUE_AT_RULES = new Set([
  "keyframes",
  "-webkit-keyframes",
  "property",
  "font-face",
  "counter-style",
  "font-feature-values",
  "font-palette-values",
]);

function scopeSelector(selector: string): string {
  const parts: string[] = [];
  selectorParser((root) => {
    root.each((part) => {
      const trimmed = part.toString().trim();
      if (ROOT_LIKE.test(trimmed)) {
        parts.push(CONTAINER);
        return;
      }
      const theme = trimmed.replace(/^(?::root|:host|html|body)(?=[.[:])/, "");
      if (THEME_STATE.test(theme)) {
        parts.push(`${theme} ${CONTAINER}`, `${CONTAINER}${theme}`);
        return;
      }
      if (
        part.nodes.some(
          (node) => node.type === "class" && `.${node.value}` === CONTAINER,
        )
      ) {
        parts.push(trimmed);
        return;
      }
      const compound = trimmed.match(
        /^(?::root|:host(?:\([^)]*\))?|html|body)([.#[:].*)$/,
      );
      parts.push(
        compound ? `${CONTAINER}${compound[1]}` : `${CONTAINER} ${trimmed}`,
      );
      // The form root also carries utility classes.
      const relation = part.nodes.find((node) => node.type === "combinator");
      if (
        !compound &&
        part.first?.type === "class" &&
        (!relation || ["", ">"].includes(relation.value.trim()))
      ) {
        const self = part.clone();
        self.prepend(selectorParser.className({ value: CONTAINER.slice(1) }));
        parts.push(self.toString().trim());
      }
    });
  }).processSync(selector);
  return [...new Set(parts)].join(", ");
}

function hasScopedParent(rule: Rule): boolean {
  let parent: Rule["parent"] | Root["parent"] = rule.parent;
  while (parent) {
    if (parent.type === "rule") return true;
    if (
      parent.type === "atrule" &&
      OPAQUE_AT_RULES.has((parent as AtRule).name.toLowerCase())
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

const scopePlugin: PostcssPlugin = {
  postcssPlugin: "care-vision-prescription-scope",
  Once(root) {
    root.walkRules((rule) => {
      // Nested selectors inherit the scope from their parent rule.
      if (!hasScopedParent(rule)) {
        rule.selector = scopeSelector(rule.selector);
        if (rule.selector === CONTAINER) {
          for (const property of [
            "font-family",
            "font-feature-settings",
            "font-variation-settings",
          ]) {
            rule.walkDecls(property, (declaration) => {
              declaration.value = "inherit";
            });
          }
        }
      }
    });
  },
};

export default scopePlugin;

export function scopeTailwindOutput(): Plugin {
  return {
    name: "care-vision-prescription-scope-css",
    enforce: "post",
    async generateBundle(_options, bundle) {
      const postcss = (await import("postcss")).default;
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type !== "asset" || !fileName.endsWith(".css")) continue;
        const result = await postcss([scopePlugin]).process(
          String(asset.source),
          {
            from: fileName,
          },
        );
        asset.source = result.css;
      }
    },
  };
}
