# Kiosk Source Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use goodvibes:executing-plans (default) or goodvibes:subagent-driven-development (opt-in for high-risk or unfamiliar work) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock v1 T17 by patching kiosk source via overrides — replace `kiosk/src/index.tsx` with a no-telemetry bootstrap, add an ambient `kiosk/src/pxt.d.ts`, drop the absent react aliases from `kiosk/tsconfig.paths.json`, extend `pxt-stub.js` with the runtime values the new ambient declarations promise, and add a Node-22 fail-fast to `apply-overrides.sh`.

**Architecture:** All customizations live in `overrides/` at the repo root and are copied into `vendor/pxt/kiosk/` at build time by `scripts/apply-overrides.sh`. The submodule itself stays pristine. TypeScript picks up the ambient `pxt.d.ts` via `tsconfig.json`'s `include: ["src"]` — no triple-slash refs, no tsconfig edits. The new `index.tsx` deliberately does NOT call `pxt.setupWebConfig`, `pxt.setAppTarget`, `pxt.analytics.enable`, or `pxt.worker.getWorker`, and never reassigns `pxt.Cloud.apiRoot` (the stub pins it to `about:blank`).

**Tech Stack:** TypeScript 4.x (kiosk-pinned), React 17 idiom (`ReactDOM.render`), CRA + react-app-rewired, Jest 30 + jsdom, bash scripts under `scripts/`.

**Design source:** [`docs/goodvibes/specs/2026-05-26-kiosk-source-overrides-design.md`](../specs/2026-05-26-kiosk-source-overrides-design.md) (commit `75c3ecb` on branch `v1-scaffold`).

**Hand-off:** When this plan ships green, resume the v1 scaffold plan at T17 (local build validation) → T18 (full Jest suite + coverage). T17 may surface 1–3 additional `pxt.*` symbols that need adding to `pxt.d.ts` + `pxt-stub.js`; that's expected per the design's risk table.

**Pre-flight check (before Task 1):** Confirm worktree state.

```bash
git -C /Users/glamb/Repositories/elliotgames/mkc-arcade-kiosk/.worktrees/v1-scaffold log --oneline -1
# Expected: 2389f81 docs(todo): defer project-standards promotions until T17/T18 green

node --version
# Expected: v22.x.x — if not, run `nvm use` before starting. The plan adds a
# fail-fast that will catch this, but better to fix the dev shell first.
```

---

## Task 1: Add Node-22 fail-fast to apply-overrides.sh

**Why first:** It's independent of the other changes, lowest risk, and unblocks the test harness for future tasks. If the dev shell is on the wrong Node major, this catches it before any submodule mutation.

**Files:**
- Modify: `scripts/apply-overrides.sh` (insert new stanza after `ROOT=...` line, before existing `KIOSK=` check)
- Modify: `tests/apply-overrides.test.js` (append new `describe` block at end)

- [ ] **Step 1: Write the failing test**

Append to the end of `tests/apply-overrides.test.js`:

```javascript
describe("Node version gate", () => {
    const path = require("path");
    const fs = require("fs");
    const os = require("os");
    const { spawnSync } = require("child_process");

    let tmpdir;

    beforeEach(() => {
        tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "mkc-node-gate-"));
    });

    afterEach(() => {
        fs.rmSync(tmpdir, { recursive: true, force: true });
    });

    test("exits 1 with a clear message when node major mismatches .nvmrc", () => {
        const fakeNode = path.join(tmpdir, "node");
        fs.writeFileSync(fakeNode, "#!/bin/bash\necho v99.0.0\n", { mode: 0o755 });

        const ROOT = path.join(__dirname, "..");
        const result = spawnSync(
            path.join(ROOT, "scripts/apply-overrides.sh"),
            [],
            {
                env: { ...process.env, PATH: `${tmpdir}:${process.env.PATH}` },
                encoding: "utf8",
            }
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/Node 99\.x running, \.nvmrc requires 22\.x/);
    });

    test("exits 1 when node is not on PATH at all", () => {
        const emptyDir = path.join(tmpdir, "empty");
        fs.mkdirSync(emptyDir);

        const ROOT = path.join(__dirname, "..");
        const result = spawnSync(
            path.join(ROOT, "scripts/apply-overrides.sh"),
            [],
            {
                env: { ...process.env, PATH: emptyDir },
                encoding: "utf8",
            }
        );

        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/'node' not on PATH/);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/apply-overrides.test.js -t "Node version gate" --verbose`
Expected: 2 failures. The script currently has no Node gate, so it'll either proceed past the check (and likely fail later on a missing submodule) OR exit with a different status/message. Either way, the `expect(result.status).toBe(1)` + stderr regex won't both pass.

- [ ] **Step 3: Implement the minimal code to make the tests pass**

In `scripts/apply-overrides.sh`, locate this block near the top:

```bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KIOSK="$ROOT/vendor/pxt/kiosk"

if [[ ! -d "$KIOSK" ]]; then
```

Insert this stanza between the `ROOT=...` line and the `KIOSK=...` line:

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

The file now reads `... ROOT=... [new stanza] KIOSK=... [rest unchanged]`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/apply-overrides.test.js --verbose`
Expected: ALL tests pass (the 2 new gate tests + the 7 pre-existing integration tests from v1 T13).

If the pre-existing tests fail because they now hit the gate, verify your shell is on Node 22 (`node --version`). The gate accepts only major 22.

- [ ] **Step 5: Commit**

```bash
git add scripts/apply-overrides.sh tests/apply-overrides.test.js
git commit -m "feat(scripts): add Node 22 fail-fast to apply-overrides.sh"
```

---

## Task 2: Extend pxt-stub.js with BrowserUtils.isLocalHost + Utils.escapeForRegex

**Why second:** Independent of the rest, and Task 5's `index.tsx` will eventually depend on the runtime values. Doing this before `pxt.d.ts` means the stub is "ahead of" the contract, which is the safer ordering — no period where the d.ts promises something the stub doesn't deliver.

**Files:**
- Modify: `overrides/public/pxt-stub.js` (append new namespaces to the existing IIFE)
- Modify: `tests/pxt-stub.test.js` (append new tests)

- [ ] **Step 1: Write the failing tests**

Append to the end of `tests/pxt-stub.test.js`, inside the existing top-level `describe` block (just before the final closing `});` of that describe):

```javascript
    describe("BrowserUtils namespace", () => {
        test("isLocalHost() returns false", () => {
            expect(typeof window.pxt.BrowserUtils.isLocalHost).toBe("function");
            expect(window.pxt.BrowserUtils.isLocalHost()).toBe(false);
        });
    });

    describe("Utils namespace", () => {
        test("escapeForRegex aliases the existing Util.escapeForRegex", () => {
            expect(typeof window.pxt.Utils.escapeForRegex).toBe("function");
            expect(window.pxt.Utils.escapeForRegex).toBe(
                window.pxt.Util.escapeForRegex
            );
        });

        test("Utils.escapeForRegex escapes regex metacharacters correctly", () => {
            expect(window.pxt.Utils.escapeForRegex("a.b*c")).toBe("a\\.b\\*c");
        });
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/pxt-stub.test.js --verbose`
Expected: 3 new failures (`TypeError: Cannot read properties of undefined (reading 'isLocalHost')` etc.) plus the 12 existing tests passing.

- [ ] **Step 3: Implement the minimal code to make the tests pass**

In `overrides/public/pxt-stub.js`, locate the existing assignment of `pxt.Util` (which defines `escapeForRegex` per SPEC §4.10). Just before the IIFE's closing `})()`, append these two assignments inside the IIFE:

```javascript
    // Kiosk source uses pxt.BrowserUtils.isLocalHost — the carousel runs on
    // GitHub Pages or file:// in the tvOS shell, never localhost-only.
    pxt.BrowserUtils = { isLocalHost: function () { return false; } };

    // Kiosk source uses pxt.Utils (plural). Alias to the singular Util that
    // the SPEC §4.10 stub already provides. Extend this namespace when T17
    // surfaces additional Utils.* references.
    pxt.Utils = { escapeForRegex: pxt.Util.escapeForRegex };
```

Place them between the existing `pxt.Util = ...` assignment and the `})()` that closes the IIFE.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/pxt-stub.test.js --verbose`
Expected: ALL tests pass (15 total: 12 pre-existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add overrides/public/pxt-stub.js tests/pxt-stub.test.js
git commit -m "feat(overrides): add BrowserUtils + Utils to pxt-stub.js"
```

---

## Task 3: Add overrides/tsconfig.paths.json

**Why third:** Pure config file, no dependencies on other tasks. Tested via JSON-parse assertion.

**Files:**
- Create: `overrides/tsconfig.paths.json`
- Create: `tests/tsconfig-paths.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/tsconfig-paths.test.js` with this content:

```javascript
const fs = require("fs");
const path = require("path");

describe("overrides/tsconfig.paths.json", () => {
    const file = path.join(__dirname, "..", "overrides", "tsconfig.paths.json");

    test("file exists and parses as JSON", () => {
        expect(fs.existsSync(file)).toBe(true);
        const text = fs.readFileSync(file, "utf8");
        expect(() => JSON.parse(text)).not.toThrow();
    });

    test("drops the react/* alias (Tech Debt #2 fix)", () => {
        const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
        const paths = cfg.compilerOptions?.paths || {};
        expect(paths["react/*"]).toBeUndefined();
    });

    test("drops the react-dom/* alias (Tech Debt #2 fix)", () => {
        const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
        const paths = cfg.compilerOptions?.paths || {};
        expect(paths["react-dom/*"]).toBeUndefined();
    });

    test("keeps the react-common/* alias (defensive)", () => {
        const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
        const paths = cfg.compilerOptions?.paths || {};
        expect(paths["react-common/*"]).toEqual(["../react-common/*"]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tsconfig-paths.test.js --verbose`
Expected: 4 failures, all `ENOENT` / file does not exist.

- [ ] **Step 3: Implement the minimal code to make the tests pass**

Create `overrides/tsconfig.paths.json` with this exact content:

```json
{
    "compilerOptions": {
        "paths": {
            "react-common/*": ["../react-common/*"]
        }
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/tsconfig-paths.test.js --verbose`
Expected: 4 passes.

- [ ] **Step 5: Commit**

```bash
git add overrides/tsconfig.paths.json tests/tsconfig-paths.test.js
git commit -m "feat(overrides): add tsconfig.paths.json dropping react aliases"
```

---

## Task 4: Add overrides/src/pxt.d.ts (ambient declarations)

**Why fourth:** Independent of Tasks 5-6 (we can write the d.ts before the index.tsx that consumes it). The test is a static-text scan of the file content, asserting each declared namespace/function is present.

**Files:**
- Create: `overrides/src/pxt.d.ts`
- Create: `tests/pxt-d-ts.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/pxt-d-ts.test.js` with this content:

```javascript
const fs = require("fs");
const path = require("path");

describe("overrides/src/pxt.d.ts", () => {
    const file = path.join(__dirname, "..", "overrides", "src", "pxt.d.ts");
    let text;

    beforeAll(() => {
        text = fs.readFileSync(file, "utf8");
    });

    test("declares the pxt global namespace", () => {
        expect(text).toMatch(/declare\s+global\s*{[\s\S]*namespace\s+pxt\s*{/);
    });

    test.each([
        ["appTarget", /let\s+appTarget\s*:\s*TargetBundle/],
        ["webConfig", /let\s+webConfig\s*:\s*WebConfig/],
        ["options", /let\s+options\s*:/],
        ["tickEvent", /function\s+tickEvent\s*\(/],
        ["targetConfigAsync", /function\s+targetConfigAsync\s*\(/],
        ["TargetBundle", /interface\s+TargetBundle\s*{/],
        ["WebConfig", /interface\s+WebConfig\s*{/],
        ["TargetConfig", /interface\s+TargetConfig\s*{/],
        ["Cloud.apiRoot", /namespace\s+Cloud\s*{[\s\S]*let\s+apiRoot/],
        ["BrowserUtils.isLocalHost", /namespace\s+BrowserUtils\s*{[\s\S]*isLocalHost/],
        ["Utils.escapeForRegex", /namespace\s+Utils\s*{[\s\S]*escapeForRegex/],
    ])("declares %s", (_label, pattern) => {
        expect(text).toMatch(pattern);
    });

    test("file ends with `export {};` to mark it as a module", () => {
        expect(text.trim()).toMatch(/export\s*{\s*}\s*;?\s*$/);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/pxt-d-ts.test.js --verbose`
Expected: All 13 cases fail (`ENOENT: no such file or directory, open 'overrides/src/pxt.d.ts'`).

- [ ] **Step 3: Implement the minimal code to make the tests pass**

Create `overrides/src/pxt.d.ts` with this exact content:

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
            let apiRoot: string;
        }

        namespace BrowserUtils {
            function isLocalHost(): boolean;
        }

        namespace Utils {
            function escapeForRegex(s: string): string;
        }
    }
}

export {};
```

Note: ensure `overrides/src/` exists first — `mkdir -p overrides/src` if not.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/pxt-d-ts.test.js --verbose`
Expected: 13 passes.

- [ ] **Step 5: Commit**

```bash
mkdir -p overrides/src  # idempotent; safe if already exists
git add overrides/src/pxt.d.ts tests/pxt-d-ts.test.js
git commit -m "feat(overrides): add pxt.d.ts ambient declarations"
```

---

## Task 5: Add overrides/src/index.tsx (no-telemetry bootstrap)

**Why fifth:** Depends on Task 4 (consumes the types) and Task 2 (consumes the runtime values). The test asserts the no-telemetry invariant as machine-checked text guards.

**Files:**
- Create: `overrides/src/index.tsx`
- Create: `tests/kiosk-overrides.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/kiosk-overrides.test.js` with this content:

```javascript
const fs = require("fs");
const path = require("path");

describe("overrides/src/index.tsx (no-telemetry bootstrap)", () => {
    const file = path.join(__dirname, "..", "overrides", "src", "index.tsx");
    let text;

    beforeAll(() => {
        text = fs.readFileSync(file, "utf8");
    });

    describe("banned upstream calls (no-telemetry invariant)", () => {
        test.each([
            ["pxt.setupWebConfig", /pxt\.setupWebConfig\s*\(/],
            ["pxt.setAppTarget", /pxt\.setAppTarget\s*\(/],
            ["pxt.analytics.enable", /pxt\.analytics\.enable\s*\(/],
            ["pxt.worker.getWorker", /pxt\.worker\.getWorker\s*\(/],
        ])("does NOT call %s", (_label, pattern) => {
            expect(text).not.toMatch(pattern);
        });

        test("does NOT reassign pxt.Cloud.apiRoot", () => {
            expect(text).not.toMatch(/pxt\.Cloud\.apiRoot\s*=/);
        });
    });

    describe("required bootstrap", () => {
        test("renders App via ReactDOM.render under React.StrictMode", () => {
            expect(text).toMatch(/ReactDOM\.render\s*\(/);
            expect(text).toMatch(/React\.StrictMode/);
            expect(text).toMatch(/<App\s*\/>/);
        });

        test("listens for DOMContentLoaded before mounting", () => {
            expect(text).toMatch(/addEventListener\s*\(\s*["']DOMContentLoaded["']/);
        });

        test("toggles pxt.options.debug from URL", () => {
            expect(text).toMatch(/pxt\.options\s*=\s*pxt\.options\s*\|\|/);
            expect(text).toMatch(/pxt\.options\.debug\s*=/);
        });

        test("seeds pxt.appTarget and pxt.webConfig idempotently", () => {
            expect(text).toMatch(/pxt\.appTarget\s*=\s*pxt\.appTarget\s*\|\|/);
            expect(text).toMatch(/pxt\.webConfig\s*=\s*pxt\.webConfig\s*\|\|/);
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/kiosk-overrides.test.js --verbose`
Expected: All cases fail (`ENOENT`).

- [ ] **Step 3: Implement the minimal code to make the tests pass**

Create `overrides/src/index.tsx` with this exact content:

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
    pxt.options = pxt.options || ({} as { debug: boolean });
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
    } as pxt.WebConfig);

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/kiosk-overrides.test.js --verbose`
Expected: 9 passes (5 banned-call guards + 4 required-bootstrap checks).

- [ ] **Step 5: Commit**

```bash
git add overrides/src/index.tsx tests/kiosk-overrides.test.js
git commit -m "feat(overrides): add no-telemetry index.tsx bootstrap"
```

---

## Task 6: Wire the new overrides into apply-overrides.sh + .gitignore

**Why last:** All three new override files (`src/index.tsx`, `src/pxt.d.ts`, `tsconfig.paths.json`) must exist on disk before the script copies them. Adding the copy stanzas earlier would make the existing `apply-overrides.test.js` integration test fail with `cp: No such file or directory`.

**Files:**
- Modify: `scripts/apply-overrides.sh` (insert 2 new `cp` stanzas after the existing `==> Copying games.json` step)
- Modify: `.gitignore` (append 3 entries under the existing submodule-build-artifacts section)
- Modify: `tests/apply-overrides.test.js` (append new `describe` block)

- [ ] **Step 1: Write the failing tests**

Append to the end of `tests/apply-overrides.test.js` (after the "Node version gate" block from Task 1):

```javascript
describe("Source-tree override copy steps", () => {
    const path = require("path");
    const fs = require("fs");
    const os = require("os");
    const { spawnSync } = require("child_process");

    let workdir;
    const ROOT = path.join(__dirname, "..");

    beforeEach(() => {
        // Create a fake "kiosk" tree mimicking vendor/pxt/kiosk's required
        // shape. The script needs $KIOSK to exist as a directory.
        workdir = fs.mkdtempSync(path.join(os.tmpdir(), "mkc-srcov-"));
        const fakeKiosk = path.join(workdir, "vendor", "pxt", "kiosk");
        fs.mkdirSync(path.join(fakeKiosk, "public"), { recursive: true });
        fs.mkdirSync(path.join(fakeKiosk, "src"), { recursive: true });
        // Seed minimal files the existing script stanzas need.
        fs.writeFileSync(
            path.join(fakeKiosk, "package.json"),
            JSON.stringify({ name: "kiosk" })
        );
        fs.writeFileSync(
            path.join(fakeKiosk, "public", "index.html"),
            "<!doctype html><html><head></head><body></body></html>"
        );
    });

    afterEach(() => {
        fs.rmSync(workdir, { recursive: true, force: true });
    });

    function runScript() {
        // Stage real ROOT files into the workdir so the script's ROOT-relative
        // paths resolve. Easier than building a parallel ROOT — copy the
        // overrides/ and scripts/ and .nvmrc references.
        fs.cpSync(path.join(ROOT, "overrides"), path.join(workdir, "overrides"), {
            recursive: true,
        });
        fs.cpSync(path.join(ROOT, "scripts"), path.join(workdir, "scripts"), {
            recursive: true,
        });
        fs.copyFileSync(
            path.join(ROOT, ".nvmrc"),
            path.join(workdir, ".nvmrc")
        );
        return spawnSync(
            "bash",
            [path.join(workdir, "scripts", "apply-overrides.sh")],
            { encoding: "utf8", cwd: workdir }
        );
    }

    test("copies overrides/src/index.tsx to vendor/pxt/kiosk/src/index.tsx", () => {
        const result = runScript();
        expect(result.status).toBe(0);
        const dest = path.join(workdir, "vendor/pxt/kiosk/src/index.tsx");
        const src = path.join(ROOT, "overrides/src/index.tsx");
        expect(fs.readFileSync(dest, "utf8")).toBe(fs.readFileSync(src, "utf8"));
    });

    test("copies overrides/src/pxt.d.ts to vendor/pxt/kiosk/src/pxt.d.ts", () => {
        const result = runScript();
        expect(result.status).toBe(0);
        const dest = path.join(workdir, "vendor/pxt/kiosk/src/pxt.d.ts");
        const src = path.join(ROOT, "overrides/src/pxt.d.ts");
        expect(fs.readFileSync(dest, "utf8")).toBe(fs.readFileSync(src, "utf8"));
    });

    test("copies overrides/tsconfig.paths.json to vendor/pxt/kiosk/tsconfig.paths.json", () => {
        const result = runScript();
        expect(result.status).toBe(0);
        const dest = path.join(workdir, "vendor/pxt/kiosk/tsconfig.paths.json");
        const src = path.join(ROOT, "overrides/tsconfig.paths.json");
        expect(fs.readFileSync(dest, "utf8")).toBe(fs.readFileSync(src, "utf8"));
    });

    test("is idempotent for the new copy steps (second run is a no-op)", () => {
        const first = runScript();
        expect(first.status).toBe(0);
        const snapshot = fs.readFileSync(
            path.join(workdir, "vendor/pxt/kiosk/src/index.tsx")
        );
        const second = runScript();
        expect(second.status).toBe(0);
        expect(
            fs.readFileSync(
                path.join(workdir, "vendor/pxt/kiosk/src/index.tsx")
            )
        ).toEqual(snapshot);
    });
});

describe(".gitignore", () => {
    const fs = require("fs");
    const path = require("path");
    const text = fs.readFileSync(
        path.join(__dirname, "..", ".gitignore"),
        "utf8"
    );

    test.each([
        "vendor/pxt/kiosk/src/index.tsx",
        "vendor/pxt/kiosk/src/pxt.d.ts",
        "vendor/pxt/kiosk/tsconfig.paths.json",
    ])("ignores submodule destination %s", (entry) => {
        expect(text).toContain(entry);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/apply-overrides.test.js -t "Source-tree override" --verbose && npx jest tests/apply-overrides.test.js -t ".gitignore" --verbose`
Expected: 4 source-tree copy failures (no `cp` stanzas yet → destination files missing) + 3 .gitignore failures (entries not yet appended).

- [ ] **Step 3: Implement the script copy stanzas**

In `scripts/apply-overrides.sh`, locate the existing block:

```bash
echo "==> Copying games.json -> kiosk public root"
cp -f "$ROOT/overrides/games.json" "$KIOSK/public/games.json"
```

Insert **immediately after** that block, **before** the existing `==> Patching package.json homepage`:

```bash
echo "==> Copying src/ overrides (kiosk bootstrap + pxt ambient d.ts)"
cp -f "$ROOT/overrides/src/index.tsx" "$KIOSK/src/index.tsx"
cp -f "$ROOT/overrides/src/pxt.d.ts"  "$KIOSK/src/pxt.d.ts"

echo "==> Copying tsconfig.paths.json override (drops absent react aliases)"
cp -f "$ROOT/overrides/tsconfig.paths.json" "$KIOSK/tsconfig.paths.json"

```

- [ ] **Step 4: Implement the .gitignore additions**

Locate the existing block in `.gitignore`:

```
vendor/pxt/kiosk/build/
vendor/pxt/kiosk/node_modules/
vendor/pxt/kiosk/public/native-gamepad-bridge.js
vendor/pxt/kiosk/public/pxt-stub.js
vendor/pxt/kiosk/public/games.json
```

Append three more lines so the block reads:

```
vendor/pxt/kiosk/build/
vendor/pxt/kiosk/node_modules/
vendor/pxt/kiosk/public/native-gamepad-bridge.js
vendor/pxt/kiosk/public/pxt-stub.js
vendor/pxt/kiosk/public/games.json
vendor/pxt/kiosk/src/index.tsx
vendor/pxt/kiosk/src/pxt.d.ts
vendor/pxt/kiosk/tsconfig.paths.json
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest --verbose`
Expected: ALL tests pass across every test file (run the full suite to confirm no regressions from this final task).

If the existing 7-test integration block from v1 T13 fails because it doesn't pre-seed `vendor/pxt/kiosk/src/`, you may need to extend the existing fake-kiosk setup helper in that block too — investigate by reading the failing assertion. Likely fix: add `fs.mkdirSync(path.join(fakeKiosk, "src"), { recursive: true })` to the existing helper. Do NOT rewrite the existing tests; just extend the fixture setup if and only if a test fails.

- [ ] **Step 6: Verify end-to-end on the real submodule (idempotency check)**

```bash
./scripts/apply-overrides.sh
./scripts/apply-overrides.sh
git -C vendor/pxt diff --stat
```

Expected: First run mutates `vendor/pxt/kiosk/` (the working tree was already dirty from prior sessions, so the diff stat may not be empty before either run — what matters is that the second run produces no additional changes).

If the second invocation produces a non-empty `git -C vendor/pxt diff` against the first invocation's state, debug — idempotency is part of `project-standards` § "Build flow".

- [ ] **Step 7: Commit**

```bash
git add scripts/apply-overrides.sh .gitignore tests/apply-overrides.test.js
git commit -m "feat(scripts): wire src/ overrides + tsconfig.paths.json copy"
```

---

## Post-plan: hand-off to v1 plan resumption

When all 6 tasks above are committed and `npx jest` is green:

1. The kiosk-source-overrides extension is **complete**. The override files exist, the apply-overrides.sh wires them in, the tests guard the no-telemetry invariant, and the Node-22 fail-fast is live.

2. **Resume the v1 plan at T17** (local build validation):
   ```bash
   nvm use   # ensure Node 22
   ./scripts/apply-overrides.sh
   cd vendor/pxt/kiosk
   npm ci
   CI=false npm run build
   ```
   Expected: clean build. If TS2304 / TS2339 surfaces for additional `pxt.*` symbols, extend `overrides/src/pxt.d.ts` (declaration) AND `overrides/public/pxt-stub.js` (runtime no-op) in lockstep, re-run the build, repeat. The design's risk table predicts 1–3 such symbols on the first build pass.

3. **Then T18** (full Jest suite + coverage):
   ```bash
   cd /Users/glamb/Repositories/elliotgames/mkc-arcade-kiosk/.worktrees/v1-scaffold
   npm test -- --coverage
   ```
   Expected: ≥75% coverage on `overrides/` and `scripts/`.

4. Once T17 + T18 are both green, revisit the deferred project-standards promotions logged in TODO.md under `## Someday/Maybe` (the post-Dependabot-bump check, the compile-time coupling note, the Node 22 fail-fast as confirmed property).
