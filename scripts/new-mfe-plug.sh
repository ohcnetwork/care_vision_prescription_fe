#!/usr/bin/env bash
# Adapted from care-plug-engineering/scripts/new-mfe-plug.sh.
# Fork the reference chassis. Export only the owned files. Make no commits.
set -euo pipefail

PLUG="${1:-care_vision_prescription_fe}"
TARGET="${2:-.}"
REF="${CPE_REF:-main}"
UPSTREAM="https://github.com/ohcnetwork/care_teleicu_devices_fe.git"
SOURCE="scripts/.scaffold-teleicu.git"
LOCAL_REF="/Users/rithviknishad/ohc.network/care_teleicu_devices_fe"

[[ "$PLUG" == "care_vision_prescription_fe" ]] || {
  echo "This adaptation is for care_vision_prescription_fe only." >&2
  exit 2
}
[[ ! -e "$SOURCE" ]] || {
  echo "The scaffold source path already exists. No files were changed." >&2
  exit 1
}

if [[ "${CPE_LOCAL_ONLY:-0}" == "1" ]]; then
  SOURCE="$LOCAL_REF"
elif git clone --bare --depth 1 --single-branch --branch "$REF" "$UPSTREAM" "$SOURCE"; then
  echo "Use the upstream revision."
elif git -C "$LOCAL_REF" rev-parse --verify HEAD >/dev/null 2>&1; then
  SOURCE="$LOCAL_REF"
  echo "Upstream is not available. Use the local reference revision."
else
  echo "No reference revision is available." >&2
  exit 1
fi

python3 - "$PLUG" "$TARGET" "$SOURCE" "$UPSTREAM" "$REF" <<'PY'
import hashlib
import json
import pathlib
import subprocess
import sys

plug, target_arg, source_arg, upstream, ref = sys.argv[1:]
target = pathlib.Path(target_arg).resolve(strict=True)
source = pathlib.Path(source_arg).resolve(strict=True)
if target != pathlib.Path.cwd().resolve():
    raise SystemExit("Run this adaptation in the existing plug workspace.")
revision = subprocess.check_output(
    ["git", "-C", str(source), "rev-parse", "HEAD"], text=True
).strip()
files = {
    "package.json": "package.json",
    "vite.config.mts": "vite.config.mts",
    "tsconfig.json": "tsconfig.json",
    "tsconfig.app.json": "tsconfig.app.json",
    "tsconfig.node.json": "tsconfig.node.json",
    "eslint.config.mjs": "eslint.config.js",
    ".prettierrc.json": ".prettierrc",
    ".gitignore": ".gitignore",
    "components.json": "components.json",
    "src/lib/utils.ts": "src/lib/utils.ts",
    "src/hooks/useTranslation.ts": "src/hooks/useTranslation.ts",
    "scripts/sort-locales.ts": "scripts/sort-locales.ts",
    "LICENSE": "scripts/licenses/teleicu-LICENSE",
}
records = []
for origin, destination in files.items():
    content = subprocess.check_output(
        ["git", "-C", str(source), "show", f"{revision}:{origin}"]
    )
    output = target / destination
    output.parent.mkdir(parents=True, exist_ok=True)
    if not output.parent.resolve().is_relative_to(target):
        raise SystemExit(f"Refuse a path outside the workspace: {destination}")
    try:
        with output.open("xb") as handle:
            handle.write(content)
        status = "copied"
    except FileExistsError:
        status = "preserved"
    records.append({
        "source": origin,
        "target": destination,
        "sha256": hashlib.sha256(content).hexdigest(),
        "status": status,
    })

provenance = {
    "plugin": plug,
    "upstream": upstream,
    "ref": ref,
    "revision": revision,
    "scaffold": "care-plug-engineering/scripts/new-mfe-plug.sh",
    "adaptation": "Allowlist export into an existing workspace. No cleanup, commits, or install.",
    "files": records,
}
with (target / "scripts/scaffold-provenance.json").open("x") as handle:
    json.dump(provenance, handle, indent=2)
    handle.write("\n")
print(f"Forked {upstream} at {revision}")
for record in records:
    print(f'{record["status"]}: {record["target"]}')
PY
