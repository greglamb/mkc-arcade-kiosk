# Design: kiosk source overrides (v1 plan extension)

**Date:** 2026-05-26
**Status:** Approved (pending user review of this doc)
**Parent design:** [`2026-05-26-mkc-arcade-kiosk-v1-scaffold-design.md`](2026-05-26-mkc-arcade-kiosk-v1-scaffold-design.md)
**Source of truth:** `mkc-arcade-kiosk-SPEC.md` (with [ADDENDUM-01](../../../mkc-arcade-kiosk-ADDENDUM-01.md)). This document amends — but does not replace — SPEC §4.10's premise that a single `pxt-stub.js` is sufficient to keep the kiosk network-silent.

## 0. Why this exists

The v1 scaffold plan reached T16/18 successfully and then blocked at T17 (local build validation). Two facts make SPEC §4.10's "minimal pxt-stub" architecture insufficient at the pinned SHA `1aa8c6c`:

1. **TypeScript compile-time coupling.** The kiosk's source tree references `pxt.appTarget`, `pxt.BrowserUtils.isLocalHost`, `pxt.Cloud.apiRoot`, `pxt.TargetConfig`, `pxt.targetConfigAsync`, `pxt.tickEvent`, `pxt.Utils`, and `pxt.webConfig` outside `index.tsx`. Without `built/pxt.d.ts` (a gulp output), the build fails with `TS2304: Cannot find name 'pxt'`. We can't ship the upstream gulp build (heavy, native-compile-fragile, re-introduces Microsoft analytics + `Cloud.apiRoot` pointing at makecode.com).

2. **Runtime network leak.** Even if the compile were unblocked, `kiosk/src/index.tsx` line 47 hard-codes `pxt.Cloud.apiRoot = "https://www.makecode.com/api/"` and line 14's `enableAnalytics()` registers the Microsoft analytics provider. Both directly violate the project's "no telemetry leaves the device" invariant.

This design extends the override scope from `overrides/public/` (browser scripts) into a new `overrides/src/` (kiosk source patches), gives TypeScript the ambient declarations it needs, replaces the kiosk's bootstrap with a no-telemetry version, and folds in Tech Debt #2 (`tsconfig.paths.json` react alias) and Tech Debt #3 (Node 22 enforcement).

## 1. Scope

In:
- Replace `vendor/pxt/kiosk/src/index.tsx` with our no-telemetry bootstrap (via `overrides/src/index.tsx`).
- Add an ambient `kiosk/src/pxt.d.ts` declaring the minimal `pxt` global surface (via `overrides/src/pxt.d.ts`).
- Override `kiosk/tsconfig.paths.json` to drop the `react/*` and `react-dom/*` aliases (via `overrides/tsconfig.paths.json`).
- Extend `overrides/public/pxt-stub.js` with `pxt.BrowserUtils.isLocalHost` and `pxt.Utils.*` runtime values.
- Extend `scripts/apply-overrides.sh`: Node 22 fail-fast at the top, copy the three new override files.
- Extend `.gitignore` for the three new submodule destinations.
- Extend the Jest suite with TDD coverage for every change (RED-GREEN-REFACTOR per file).

Out:
- Editing anything under `vendor/pxt/kiosk/src/` *except* the new `index.tsx` and `pxt.d.ts`. `App.tsx`, `Services/`, `Components/`, etc., remain upstream-as-is.
- Owning the React component tree.
- Editing `tsconfig.json` itself (we override only the `paths` partial it extends).
- Authoring `mkc-arcade-kiosk-ADDENDUM-02.md` as a sibling spec doc. The addendum is deferred until T17 and T18 ship green; the design doc here is enough for the implementation pass.
- A round-trip PR to `mkc-arcade-kiosk-SPEC.md`. That will be batched later with the three earlier scaffold bug fixes.

## 2. Non-goals

All v1 scaffold non-goals (parent design §2) carry forward unchanged.

## 3. Approach (chosen): minimal ambient d.ts in `kiosk/src/`

For each source-level override:

1. `overrides/src/index.tsx` replaces upstream's bootstrap. Deliberately does NOT call `pxt.setupWebConfig`, `pxt.setAppTarget`, `pxt.analytics.enable`, or `pxt.worker.getWorker`. Deliberately does NOT touch `pxt.Cloud.apiRoot` (the stub pins it to `about:blank`).
2. `overrides/src/pxt.d.ts` declares the minimal `pxt` ambient surface used by `kiosk/src/`. `apply-overrides.sh` copies it into `vendor/pxt/kiosk/src/pxt.d.ts` — inside `tsconfig.json`'s `include: ["src"]`, so TypeScript picks it up with no `tsconfig` edit. No triple-slash references needed anywhere.
3. `overrides/tsconfig.paths.json` drops the two react aliases. Standard webpack/node resolution finds React in `kiosk/node_modules/react` (which `npm ci` populates) without aliasing.
4. `overrides/public/pxt-stub.js` extended to provide runtime values for the new ambient declarations.
5. `scripts/apply-overrides.sh` extended with a Node-version gate (`.nvmrc` vs. `node --version`) and three new copy steps.

The new override files are gitignored at the outer repo (defensive — submodule isolation already prevents commits into `vendor/pxt/`).

## 4. Rejected approaches

To be logged in `TODO.md` under `## Rejected Approaches` per the project's no-silent-rejections rule.

1. **Triple-slash reference to a shimmed `vendor/pxt/built/pxt.d.ts`.** *Rejected:* same content as the chosen approach but the shim lives outside `include: ["src"]`, requiring explicit triple-slash refs in our `index.tsx`. Adds indirection for no benefit — we still author every declaration.
2. **Run upstream `gulp build` once and commit `built/pxt.d.ts` artifacts.** *Rejected:* re-introduces the heavyweight pxt-core dependency we just decided to avoid (the leveldown native-compile failure under Node 24 was the canary). Committed binaries go stale on every monthly bump; we'd be re-running gulp inside `apply-overrides.sh` forever. Directly conflicts with the SPEC's submodule-isolation premise.
3. **Install React family at `vendor/pxt/` root via `npm install --no-save --ignore-scripts` in `apply-overrides.sh` (the current T17 workaround).** *Rejected:* writes into the submodule's `node_modules`, which while ignored at the outer repo creates a long-running implicit dependency, and `--ignore-scripts` masks build failures we'd prefer to see. The tsconfig-paths override is cleaner.
4. **Author ADDENDUM-02 immediately as a sibling to SPEC.** *Rejected for now:* premature — the design might evolve during T17 implementation. The design doc here is the working source of truth; the addendum, if needed, gets authored after T17 and T18 prove the approach.
5. **Put `pxt.BrowserUtils.isLocalHost` and `pxt.Utils.*` runtime values in `index.tsx` instead of `pxt-stub.js`.** *Rejected:* mixes concerns. The stub is the always-on baseline (provides the network-silent contract); `index.tsx` is the React-tree entry point. Stub gets the runtime values; `index.tsx` gets the React-mount.
6. **Add `"engines": { "node": "22.x" }` to root `package.json` instead of a script-level gate.** *Rejected:* npm warnings get ignored; project-standards explicitly forbids `"engines"` in root `package.json` (it's a kiosk-internal concern). A hard fail-fast in `apply-overrides.sh` is what catches the footgun.
7. **Reskin the kiosk's bootstrap with our own React entry tree.** *Rejected:* out of v1 scope. Would mean owning the entire React tree, not patching upstream — invalidates the submodule + overrides architecture.

## 5. File inventory

| Path | Status | Copied at build to | Purpose |
|---|---|---|---|
| `overrides/src/index.tsx` | **new** | `vendor/pxt/kiosk/src/index.tsx` | No-telemetry bootstrap |
| `overrides/src/pxt.d.ts` | **new** | `vendor/pxt/kiosk/src/pxt.d.ts` | Ambient TS declarations |
| `overrides/tsconfig.paths.json` | **new** | `vendor/pxt/kiosk/tsconfig.paths.json` | Drop absent react aliases |
| `overrides/public/pxt-stub.js` | **extended** | `vendor/pxt/kiosk/public/pxt-stub.js` | Add `BrowserUtils.isLocalHost` + `Utils.*` |
| `scripts/apply-overrides.sh` | **extended** | (self) | Node 22 fail-fast + 3 new copy steps |
| `.gitignore` | **extended** | (self) | Hide the three new submodule destinations |

`.gitignore` additions (under the existing submodule-build-artifacts section):

```
vendor/pxt/kiosk/src/index.tsx
vendor/pxt/kiosk/src/pxt.d.ts
vendor/pxt/kiosk/tsconfig.paths.json
```

## 6. `overrides/src/index.tsx`

Final field set is locked at implementation when runtime errors surface missing properties. The shape is:

```tsx
import React from "react";
import ReactDOM from "react-dom";
import "./Kiosk.css";
import App from "./App";
import { AppStateProvider } from "./State/AppStateContext";

// Kiosk-specific bootstrap.
//
// Deliberately does NOT call:
//   pxt.setupWebConfig    — would download a Microsoft web-config bundle
//   pxt.setAppTarget      — would parse upstream's TargetBundle wiring
//   pxt.analytics.enable  — would register an analytics provider
//   pxt.worker.getWorker  — would prefetch the makecode compiler worker
//
// Deliberately does NOT touch pxt.Cloud.apiRoot — that's pinned to
// "about:blank" by overrides/public/pxt-stub.js (load order: stub before
// bundle, per project-standards § "Load order is part of the contract").

window.addEventListener("DOMContentLoaded", () => {
    pxt.options = pxt.options || {};
    pxt.options.debug = /[?&](dbg|mkcDebug)=1/i.test(window.location.href);

    pxt.appTarget = pxt.appTarget || ({
        id: "mkc-arcade-kiosk",
        name: "MKC Arcade Kiosk",
        versions: { target: "0.0.0", pxt: "0.0.0" },
        appTheme: {},
    } as pxt.TargetBundle);

    pxt.webConfig = pxt.webConfig || ({
        relprefix: "./",
        verprefix: "",
        workerjs: "./worker.js",
    } as any);

    ReactDOM.render(
        <React.StrictMode>
            <AppStateProvider>
                <App />
            </AppStateProvider>
        </React.StrictMode>,
        document.getElementById("root")
    );
});
```

Key properties:
- **Zero triple-slash references.** Replaces the upstream `///` chain pointing at `../../built/*` declarations.
- **Idempotent property assignment** (`x = x || ...`) — if the stub pre-seeds, we respect it.
- **Keep `ReactDOM.render` (not `createRoot`).** Upstream uses the React-17 idiom; the React-18 deprecation warning is cosmetic; switching is unrelated cleanup. Revisit if a pxt bump introduces React 19.
- **Debug flag** matches the existing `?mkcDebug=1` convention from SPEC §4.10's stub, plus upstream's `?dbg=1` for parity.

## 7. `overrides/src/pxt.d.ts`

```ts
// overrides/src/pxt.d.ts
//
// Ambient declarations for the minimal `pxt` global surface used by the
// kiosk source tree. Implemented at runtime by overrides/public/pxt-stub.js
// (before the CRA bundle loads) and overrides/src/index.tsx (at boot).
//
// When a Dependabot pxt-submodule bump introduces a new pxt.* reference,
// the kiosk build will fail with TS2304/TS2339. Extend this file with the
// declaration AND extend pxt-stub.js with a no-op runtime — see
// project-standards § "Submodule discipline" for the post-bump checklist.

declare global {
    namespace pxt {
        // Runtime config — set by overrides/src/index.tsx before App mounts.
        let appTarget: TargetBundle;
        let webConfig: WebConfig;
        let options: { debug: boolean };

        // Telemetry — no-ops in pxt-stub.js (debug-loggable, never network).
        function tickEvent(id: string, data?: Map<string | number>): void;
        function reportError(cat: string, msg: string, data?: object): void;
        function reportException(err: unknown, data?: object): void;

        // Target config download — pxt-stub.js returns the contents of
        // /games.json wrapped in { kiosk: { games: [...] } }.
        function targetConfigAsync(): Promise<TargetConfig | undefined>;

        type Map<T> = { [k: string]: T };

        interface TargetBundle {
            id: string;
            name: string;
            versions: { target: string; pxt: string };
            appTheme: Map<unknown>;
            [k: string]: unknown;
        }

        interface WebConfig {
            relprefix: string;
            verprefix: string;
            workerjs: string;
            [k: string]: unknown;
        }

        interface TargetConfig {
            kiosk?: {
                games: Array<{
                    id: string;
                    name: string;
                    description: string;
                    highScoreMode: string;
                }>;
            };
            [k: string]: unknown;
        }

        namespace Cloud {
            let apiRoot: string; // pinned to "about:blank" by pxt-stub.js
        }

        namespace BrowserUtils {
            function isLocalHost(): boolean;
        }

        namespace Utils {
            // Members discovered during T17 TDD. Extend this namespace AND
            // pxt-stub.js together — the d.ts is the contract, the stub is
            // the implementation.
            function escapeForRegex(s: string): string;
        }
    }
}

export {};
```

The `pxt-stub.js` extension (Section 8c) provides the runtime values for everything declared here.

## 8. Build-system changes

### 8a. `overrides/tsconfig.paths.json`

```json
{
    "compilerOptions": {
        "paths": {
            "react-common/*": ["../react-common/*"]
        }
    }
}
```

Drops `react/*` and `react-dom/*`. Keeps `react-common/*` defensively (kiosk components import via relative paths, but react-common's internals may use the alias).

### 8b. `scripts/apply-overrides.sh` additions

**Top of file** (after `set -euo pipefail` and `ROOT=...`, before the existing `KIOSK=` check):

```bash
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
```

**After the existing `==> Copying games.json` step:**

```bash
echo "==> Copying src/ overrides (kiosk bootstrap + pxt ambient d.ts)"
cp -f "$ROOT/overrides/src/index.tsx" "$KIOSK/src/index.tsx"
cp -f "$ROOT/overrides/src/pxt.d.ts"  "$KIOSK/src/pxt.d.ts"

echo "==> Copying tsconfig.paths.json override (drops absent react aliases)"
cp -f "$ROOT/overrides/tsconfig.paths.json" "$KIOSK/tsconfig.paths.json"
```

Idempotency holds: `cp -f` overwrites byte-identical files with no side effects; the Node check is read-only. Existing stanzas (`%MKC_DEBUG%`, `homepage`, index.html injection) are untouched.

### 8c. `overrides/public/pxt-stub.js` extension

Add two namespaces to the existing IIFE-defined `pxt` global:

- `pxt.BrowserUtils = { isLocalHost: function() { return false; } }` — the kiosk is never localhost-only; carousel runs on Pages or `file://` in the tvOS shell.
- `pxt.Utils = { escapeForRegex: pxt.Util.escapeForRegex }` — aliases the existing singular `Util.escapeForRegex`. Extend the namespace with additional members as T17 runtime errors point them out.

The existing `pxt.Util.escapeForRegex` stays (covered by `tests/pxt-stub.test.js`). Removing it would invalidate v1 T8's tests.

### 8d. `.gitignore` additions

Append to the existing submodule-build-artifacts section:

```
vendor/pxt/kiosk/src/index.tsx
vendor/pxt/kiosk/src/pxt.d.ts
vendor/pxt/kiosk/tsconfig.paths.json
```

### 8e. Not changing

- `scripts/inject-html.js` (no HTML changes from this design).
- `scripts/bump-submodule.sh`.
- `.github/workflows/deploy.yml` (Node 22 already pinned via `setup-node@v4`).
- `package.json` root (no `"engines"` field per project-standards).
- `tsconfig.json` itself (we override only the `paths` partial).
- `mkc-arcade-kiosk-SPEC.md` (round-trip PR is later batch work).

## 9. Tests (TDD plan)

RED-GREEN-REFACTOR per file. All tests run from repo root via `npm test`. Coverage stays ≥75% (new override files are small and well-covered by static tests).

| Test file | Status | Asserts |
|---|---|---|
| `tests/pxt-stub.test.js` | **extend** | `pxt.BrowserUtils.isLocalHost()` returns `false`; `pxt.Utils.escapeForRegex` is the same function as `pxt.Util.escapeForRegex`. Existing 12 tests retained. |
| `tests/kiosk-overrides.test.js` | **new** | Static-text guards on `overrides/src/index.tsx`: no `Cloud.apiRoot =`, no `setupWebConfig`, no `setAppTarget`, no `analytics.enable`, no `worker.getWorker`. Encodes the no-telemetry invariant as a machine check. |
| `tests/pxt-d-ts.test.js` | **new** | Reads `overrides/src/pxt.d.ts` as text; asserts presence of the 8 declared namespaces/values from Section 7. Cheap regression guard against accidental deletion. |
| `tests/tsconfig-paths.test.js` | **new** | Parses `overrides/tsconfig.paths.json`; asserts `react/*` and `react-dom/*` keys absent, `react-common/*` present. |
| `tests/apply-overrides.test.js` | **extend** | Three new copy steps produce the right destination files; running script twice produces zero diff; Node-version gate: mock `node` on `PATH` to return wrong version → assert exit 1. |

## 10. Done-when

1. `cd vendor/pxt/kiosk && npm ci && CI=false npm run build` produces a clean build — no `TS2304` / `TS2339` / module-resolution errors. *(unblocks v1 T17)*
2. `build/index.html` loads in a browser; console shows zero error-level entries between page load and carousel render.
3. Dev-tools inspection: `pxt.Cloud.apiRoot === "about:blank"`. *(no-telemetry invariant verified at runtime)*
4. The carousel renders the five games from `overrides/games.json`. *(end-to-end proof that App.tsx + targetConfigAsync + appTarget all wire correctly)*
5. `./scripts/apply-overrides.sh && ./scripts/apply-overrides.sh && git -C vendor/pxt diff --stat` shows zero diff between runs. *(idempotency)*
6. Running `apply-overrides.sh` with wrong Node major exits 1 with the documented message.
7. `npm test` from repo root passes with ≥75% coverage. *(unblocks v1 T18)*

## 11. Risks

| Risk | Mitigation |
|---|---|
| `App.tsx` / `Services/*` references more `pxt.*` than declared. | Build canary catches it; extend `pxt.d.ts` + `pxt-stub.js` in lockstep. Expected during T17 — first pass will likely uncover 1–3 missing symbols. |
| Runtime crash because `appTarget.<some-field>` is undefined. | Start minimal in `index.tsx`; grow defaults as runtime points at missing fields. Loud failure mode by design. |
| `react-app-alias-ex` still wants the dropped aliases. | Standard webpack resolution finds React in `kiosk/node_modules` post-`npm ci`. If a deeper webpack config insists on aliasing, escape hatch: override `kiosk/config-overrides.js` too (expands inventory). |
| Dependabot bump changes `kiosk/src/` and breaks our override. | Bump PR's CI fails loudly. The post-bump grep check (Section 14 promotion candidate) is the durable mitigation. |
| Node-22 gate blocks legitimate CI runs. | CI pins Node 22 via `setup-node@v4`; gate always passes there. Only local devs without `nvm use` hit it — which is the point. |
| `pxt.Cloud.apiRoot` mutated elsewhere in `kiosk/src/` we haven't audited. | Test 2 (kiosk-overrides.test.js) catches it in `index.tsx`. For deeper coverage, add a runtime assertion in the no-telemetry CI smoke test (deferred to v1 hand-off). |

## 12. Hand-off back to v1 plan

After this extension's tasks ship green, resume the v1 implementation plan:
- **T17 (local build validation)** — now unblocked.
- **T18 (full Jest suite with coverage)** — unchanged.
- No other v1 task changes.

This extension itself becomes a sub-plan that prepends to T17. The next step is `goodvibes:writing-plans` to author 5–7 tasks of 2–5 minutes each covering Sections 6–9.

## 13. Out-of-scope (logged to `TODO.md` at post-flight)

- **ADDENDUM-02 sibling doc.** Author after T17 and T18 prove the design. Until then, this design doc in `docs/goodvibes/specs/` is the working source of truth.
- **Spec round-trip PR.** Single batch later, covering the three original §6 bug fixes plus this design's findings.
- **`pxt.Util` (singular) cleanup.** `pxt-stub.js` will still expose `pxt.Util.escapeForRegex` from v1 T8 even though no kiosk source uses it. Harmless; leaves the door open for upstream re-introducing the singular form.
- **Deeper runtime no-telemetry assertion.** A console-error guard for any code path that mutates `pxt.Cloud.apiRoot` away from `about:blank` would tighten Risk 6, but expands the stub. Defer to v1 hand-off.

## 14. Promotion candidates for `project-standards`

To be offered via `/goodvibes:promote` at post-flight:

1. **Post-Dependabot-bump check.** Add to `project-standards` § "Submodule discipline": *"Before merging a `deps(pxt):` PR, run `git -C vendor/pxt diff kiosk/src/ | grep -E 'pxt\\.[A-Za-z]+'`. Verify every newly-referenced symbol is declared in `overrides/src/pxt.d.ts` AND provided at runtime by `overrides/public/pxt-stub.js`. Extend both together; the d.ts is the contract, the stub is the implementation."*
2. **Compile-time coupling note.** `project-standards` § "Architecture invariants" point 2 currently describes the `pxt` global as a runtime telemetry stub. Expand to: *"The `pxt` global is also a load-bearing TypeScript ambient — `overrides/src/pxt.d.ts` is the contract for everything `kiosk/src/` references. The stub-only model from SPEC §4.10 is necessary but not sufficient; both files must stay in sync."*
3. **Node 22 fail-fast** is now embedded in `apply-overrides.sh`, so the operational expectation can be encoded in `project-standards` § "Build flow" as a confirmed property rather than aspirational.
