#!/usr/bin/env bash
# Idempotently copy our customizations into the pxt submodule's kiosk app
# so that `npm run build` produces our themed/instrumented kiosk.
#
# This script is safe to run multiple times. It does NOT modify the submodule
# in ways that would be staged for commit — submodule isolation handles that —
# but we add belt-and-suspenders .gitignore entries too.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Node version gate (Tech Debt #3). Catches the common "shell didn't
# auto-nvm-use" footgun before the script mutates the submodule.
REQUIRED_NODE_MAJOR=$(grep -oE '^[0-9]+' "$ROOT/.nvmrc" | head -1)
ACTUAL_NODE_MAJOR=$(node --version 2>/dev/null | grep -oE 'v[0-9]+' | tr -d v || true)
if [[ -z "$ACTUAL_NODE_MAJOR" ]]; then
    echo "ERROR: 'node' not on PATH. Run 'nvm use' or install Node ${REQUIRED_NODE_MAJOR}." >&2
    exit 1
fi
if [[ "$ACTUAL_NODE_MAJOR" != "$REQUIRED_NODE_MAJOR" ]]; then
    echo "ERROR: Node ${ACTUAL_NODE_MAJOR}.x running, .nvmrc requires ${REQUIRED_NODE_MAJOR}.x." >&2
    echo "       Run 'nvm use' or switch to Node ${REQUIRED_NODE_MAJOR} and retry." >&2
    exit 1
fi

KIOSK="$ROOT/vendor/pxt/kiosk"

if [[ ! -d "$KIOSK" ]]; then
  echo "ERROR: submodule not initialized. Run: npm run submodule:init" >&2
  exit 1
fi

echo "==> Copying public/ overrides"
cp -f "$ROOT/overrides/public/native-gamepad-bridge.js" "$KIOSK/public/"
cp -f "$ROOT/overrides/public/pxt-stub.js"              "$KIOSK/public/"

echo "==> Substituting %MKC_DEBUG% in pxt-stub.js"
# %MKC_DEBUG% is a literal placeholder in the override; replace with the env
# variable's value (default 'false'). This is the fix for SPEC §4.10's
# "implementer must merge" callout — it lives in the single script now.
DEBUG_VAL="${MKC_DEBUG:-false}"
node -e "
  const fs = require('fs');
  const p = process.argv[1];
  const v = process.argv[2];
  const text = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p, text.split('%MKC_DEBUG%').join(v));
" "$KIOSK/public/pxt-stub.js" "$DEBUG_VAL"

echo "==> Copying games.json -> kiosk public root"
cp -f "$ROOT/overrides/games.json" "$KIOSK/public/games.json"

echo "==> Copying src/ overrides (kiosk bootstrap + pxt ambient d.ts)"
cp -f "$ROOT/overrides/src/index.tsx" "$KIOSK/src/index.tsx"
cp -f "$ROOT/overrides/src/pxt.d.ts"  "$KIOSK/src/pxt.d.ts"

echo "==> Copying src/State/State.ts override (locks Add-your-game button off)"
cp -f "$ROOT/overrides/src/State/State.ts" "$KIOSK/src/State/State.ts"

echo "==> Copying src/State/AppStateContext.tsx override (default locked=true)"
cp -f "$ROOT/overrides/src/State/AppStateContext.tsx" "$KIOSK/src/State/AppStateContext.tsx"

echo "==> Copying tsconfig.paths.json override (pins single React instance)"
cp -f "$ROOT/overrides/tsconfig.paths.json" "$KIOSK/tsconfig.paths.json"

echo "==> Patching config.json GamepadPollLoopMilli (50ms -> 16ms for ~60Hz input)"
# At the kiosk default of 50ms the worst-case button-press latency is ~50ms,
# which feels sluggish on a fast game controller. 16ms aligns with a 60Hz
# display refresh and matches what browser games typically poll at.
node -e "
  const f = '$KIOSK/src/config.json';
  const c = require(f);
  c.GamepadPollLoopMilli = 16;
  require('fs').writeFileSync(f, JSON.stringify(c, null, 4) + '\n');
"

echo "==> Patching package.json homepage for relative asset paths"
# Setting homepage to "." makes CRA emit relative URLs in index.html and the
# manifest, so the build works at any subpath (GitHub Pages project URL,
# custom domain, or being loaded as a file:// URL by a native shell).
node -e "
  const f = '$KIOSK/package.json';
  const p = require(f);
  p.homepage = '.';
  require('fs').writeFileSync(f, JSON.stringify(p, null, 2) + '\n');
"

echo "==> Injecting <script> tags into index.html (idempotent, Node-based)"
node "$ROOT/scripts/inject-html.js" "$KIOSK/public/index.html"

echo "==> Done"
