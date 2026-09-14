import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const origin = "https://careui.ohc.network";
const requested = process.argv.slice(2);
const names = requested.length
  ? requested
  : ["button", "input", "label", "textarea", "table", "native-select"];
const pending = new Map();
const items = new Map();
const files = new Map();
const dependencies = new Set();
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

function registryName(value) {
  if (/^[a-z][a-z0-9-]*$/.test(value)) return value;
  const url = new URL(value);
  const match = url.pathname.match(
    /^\/registry\/care-ui\/([a-z0-9-]+)\/\1\.json$/,
  );
  if (url.origin !== origin || !match || url.search || url.hash) {
    throw new Error(`Unsupported registry dependency: ${value}`);
  }
  return match[1];
}

async function load(value) {
  const name = registryName(value);
  if (pending.has(name)) return pending.get(name);
  const task = (async () => {
    const url = `${origin}/registry/care-ui/${name}/${name}.json`;
    const { stdout } = await run(
      "curl",
      [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--max-time",
        "30",
        url,
      ],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    let item;
    try {
      item = JSON.parse(stdout);
    } catch {
      throw new Error(`The registry did not return JSON: ${url}`);
    }
    if (
      item.name !== name ||
      !Array.isArray(item.files) ||
      !item.files.length
    ) {
      throw new Error(`Invalid Care UI item: ${url}`);
    }
    const required = new Set(item.registryDependencies ?? []);
    for (const dependency of item.dependencies ?? []) {
      dependencies.add(dependency);
    }
    const provenance = [];
    for (const file of item.files) {
      if (
        typeof file.content !== "string" ||
        !file.path?.startsWith(`registry/care-ui/${name}/`) ||
        !/^[a-z0-9-]+\.tsx?$/.test(basename(file.path))
      ) {
        throw new Error(`Invalid source file in ${url}`);
      }
      const target = `src/components/ui/${basename(file.path)}`;
      const source = file.content.replace(
        /@\/(?:components\/(?:careui|ui)|hooks)\/([a-z0-9-]+)/g,
        (_match, dependency) => {
          if (dependency !== name) required.add(dependency);
          return `@/components/ui/${dependency}`;
        },
      );
      const ascii = source
        .replaceAll("\u2192", "->")
        .replaceAll("\u2014", "-")
        .replaceAll("\u00b7", " ");
      if (files.has(target) && files.get(target) !== ascii) {
        throw new Error(`Conflicting registry files: ${target}`);
      }
      files.set(target, ascii);
      provenance.push({
        path: target,
        source: file.path,
        sha256: createHash("sha256").update(file.content).digest("hex"),
      });
    }
    items.set(name, { url, files: provenance });
    await Promise.all([...required].map(load));
  })();
  pending.set(name, task);
  return task;
}

await Promise.all(names.map(load));

for (const dependency of dependencies) {
  if (!packageJson.dependencies?.[dependency]) {
    throw new Error(
      `Add the Care UI dependency to package.json: ${dependency}`,
    );
  }
}
for (const [target, content] of files) {
  if (existsSync(target) && readFileSync(target, "utf8") !== content) {
    throw new Error(`Preserve the existing file: ${target}`);
  }
}
for (const [target, content] of files) {
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target)) writeFileSync(target, content, { flag: "wx" });
  console.log(target);
}
const provenancePath = "scripts/care-ui-provenance.json";
if (existsSync(provenancePath)) {
  throw new Error(`Preserve the existing file: ${provenancePath}`);
}
writeFileSync(
  resolve(provenancePath),
  JSON.stringify(
    {
      registry: origin,
      fetchedAt: new Date().toISOString(),
      importPathChange:
        "@/hooks/* and @/components/careui/* map to @/components/ui/*.",
      items: Object.fromEntries(
        [...items].sort(([a], [b]) => a.localeCompare(b)),
      ),
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(`Care UI dependencies: ${[...dependencies].sort().join(", ")}`);
