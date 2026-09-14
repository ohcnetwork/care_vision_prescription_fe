// Adapted from care-plug-engineering/scripts/check-single-react.mjs.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const assets = fileURLToPath(new URL("../dist/assets", import.meta.url));
const leaks = [];

for (const file of readdirSync(assets).filter((name) => name.endsWith(".js"))) {
  if (file.startsWith("__federation_shared")) continue;
  const source = readFileSync(join(assets, file), "utf8");
  const hooks = new Set(
    [...source.matchAll(/\b(\w*Exports)\.(use[A-Z]\w*)\s*\(/g)].map(
      (match) => `${match[1]}.${match[2]}`,
    ),
  );
  if (source.includes("useSyncExternalStoreShim_production")) {
    hooks.add("<bundled use-sync-external-store CJS shim>");
  }
  if (hooks.size) leaks.push({ file, hooks: [...hooks] });
}

if (leaks.length) {
  console.error("FAIL: plug chunks call hooks on the bundled React:");
  for (const { file, hooks } of leaks) {
    console.error(`  ${file}: ${hooks.join(", ")}`);
  }
  console.error("Check the ESM shim aliases in vite.config.mts.");
  process.exit(1);
}
console.log("OK: plug chunks use the federation-shared React.");
