# mkc-arcade-kiosk v1 Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use goodvibes:executing-plans (default) or goodvibes:subagent-driven-development (opt-in for high-risk or unfamiliar work) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the v1 scaffold of `mkc-arcade-kiosk` end-to-end: file layout, pinned `microsoft/pxt` submodule, browser-side override files (with Jest tests), idempotent build scripts (with the SPEC bugs corrected during creation), GitHub Actions deploy + Dependabot workflows, and a green local `npm run build` plus `npm test`. Plan terminates at successful local validation; remote push, Pages enablement, and the controller smoke test are hand-off (see design doc §10).

**Architecture:** Submodule isolation — `vendor/pxt` stays pristine; all customizations live in `overrides/` and are copied into the kiosk app at build time by `scripts/apply-overrides.sh`. The script is idempotent and uses Node for `index.html` injection (portable across BSD/GNU sed). The override `pxt-stub.js` replaces the upstream PXT global with a local, network-silent implementation; `native-gamepad-bridge.js` polyfills `navigator.getGamepads()` only when running inside a WebView shell. Tests are Jest with jsdom and live in `tests/` at the repo root, independent of the kiosk build.

**Tech Stack:** Node 22, Jest 30 + jest-environment-jsdom, Ajv 8 (JSON-schema validation), Bash 3+ (for the build/bump scripts), GitHub Actions (deploy + Dependabot). Upstream Kiosk: `microsoft/pxt`'s `kiosk/` (Create-React-App, untouched).

**Design doc:** `docs/goodvibes/specs/2026-05-26-mkc-arcade-kiosk-v1-scaffold-design.md`
**Source spec:** `mkc-arcade-kiosk-SPEC.md`
**Project standards:** `.claude/skills/project-standards/SKILL.md`

---

## Pre-implementation context

This worktree is at `.worktrees/v1-scaffold/` on branch `v1-scaffold`. The main branch already contains: `LICENSE`, `README.md`, `mkc-arcade-kiosk-SPEC.md`, `.gitignore` (Node template + goodvibes additions), `CLAUDE.md`, `TODO.md`, `CHANGELOG.md`, `CHANGELOG_DIRECTIVES.md`, `.pre-commit-config.yaml`, `.gitleaks.toml`, and `.claude/skills/project-standards/SKILL.md`. The design doc lives at `docs/goodvibes/specs/2026-05-26-mkc-arcade-kiosk-v1-scaffold-design.md`. Do not re-create any of those.

Commit messages must follow Conventional Commits (validated by the `commit-message-validator.sh` PreToolUse hook). Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `revert`. First line ≤72 chars.

Gitleaks runs on every commit (pre-commit hook). Use placeholder share IDs from the SPEC; nothing in this plan introduces real secrets.

---

## Task 1: Add `.nvmrc`

**Files:**
- Create: `.nvmrc`

- [ ] **Step 1: Create the file**

Contents (single line, no trailing whitespace beyond the newline):

```
22
```

- [ ] **Step 2: Verify**

Run: `cat .nvmrc`
Expected output: `22` on its own line.

- [ ] **Step 3: Commit**

```bash
git add .nvmrc
git commit -m "chore: pin node version to 22 via .nvmrc"
```

---

## Task 2: Create root `package.json`

**Files:**
- Create: `package.json`

Per SPEC §4.4 plus devDependencies for the Jest test suite. The version is today's CalVer at scaffold time (`0.2605.2601`). The `jest` block configures the jsdom environment and the ≥75% coverage threshold from `project-standards`.

- [ ] **Step 1: Create the file**

```json
{
  "name": "mkc-arcade-kiosk",
  "version": "0.2605.2601",
  "private": true,
  "description": "Self-hosted MakeCode Arcade Kiosk with native gamepad bridge",
  "license": "MIT",
  "author": "Greg Lamb",
  "homepage": "https://github.com/greglamb/mkc-arcade-kiosk",
  "repository": {
    "type": "git",
    "url": "https://github.com/greglamb/mkc-arcade-kiosk.git"
  },
  "scripts": {
    "overrides": "./scripts/apply-overrides.sh",
    "build": "npm run overrides && npm --prefix vendor/pxt/kiosk ci && npm --prefix vendor/pxt/kiosk run build",
    "dev": "npm run overrides && npm --prefix vendor/pxt/kiosk start",
    "submodule:bump": "./scripts/bump-submodule.sh",
    "submodule:init": "git submodule update --init --recursive",
    "test": "jest --coverage"
  },
  "devDependencies": {
    "ajv": "^8.17.1",
    "jest": "^30.0.0",
    "jest-environment-jsdom": "^30.0.0"
  },
  "jest": {
    "testEnvironment": "jsdom",
    "testMatch": ["<rootDir>/tests/**/*.test.js"],
    "collectCoverageFrom": [
      "overrides/**/*.js",
      "scripts/**/*.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 75,
        "lines": 75,
        "statements": 75
      }
    }
  }
}
```

- [ ] **Step 2: Verify JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`
Expected: exits 0 with no output.

- [ ] **Step 3: Install devDeps**

Run: `npm install`
Expected: completes without errors. Creates `node_modules/` and `package-lock.json`.

- [ ] **Step 4: Verify Jest is callable**

Run: `npx jest --version`
Expected: prints a `30.x.x` version string.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add root package.json with Jest test deps"
```

(Do NOT add `node_modules/` — the standard `.gitignore` already excludes it.)

---

## Task 3: Merge submodule build-artifact entries into `.gitignore`

**Files:**
- Modify: `.gitignore`

SPEC §4.1 specifies defensive `.gitignore` entries that prevent the override-destination files inside the submodule from being staged. The current `.gitignore` (Node template + goodvibes section) doesn't have them yet.

- [ ] **Step 1: Append a new section at the end of `.gitignore`**

Append exactly these lines (note the blank line before the section header):

```
# Build artifacts inside the submodule (defensive — submodule isolation
# already prevents these from being committed, but be explicit)
vendor/pxt/kiosk/build/
vendor/pxt/kiosk/node_modules/
vendor/pxt/kiosk/public/native-gamepad-bridge.js
vendor/pxt/kiosk/public/pxt-stub.js
vendor/pxt/kiosk/public/games.json
```

- [ ] **Step 2: Verify the entries are present**

Run: `grep "vendor/pxt/kiosk/public/pxt-stub.js" .gitignore`
Expected: prints the matching line.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore submodule override-destination files"
```

---

## Task 4: Create empty directory placeholders

**Files:**
- Create: `overrides/public/.gitkeep`
- Create: `scripts/.gitkeep`
- Create: `tests/.gitkeep`
- Create: `.github/workflows/.gitkeep`

Git doesn't track empty directories. Using `.gitkeep` placeholders so each directory exists at the right path before the next tasks populate it. `vendor/` is created automatically by `git submodule add` in Task 6.

- [ ] **Step 1: Create directories and placeholders**

```bash
mkdir -p overrides/public scripts tests .github/workflows
touch overrides/public/.gitkeep scripts/.gitkeep tests/.gitkeep .github/workflows/.gitkeep
```

- [ ] **Step 2: Verify**

Run: `ls overrides/public/.gitkeep scripts/.gitkeep tests/.gitkeep .github/workflows/.gitkeep`
Expected: all four paths print, no errors.

- [ ] **Step 3: Commit**

```bash
git add overrides/public/.gitkeep scripts/.gitkeep tests/.gitkeep .github/workflows/.gitkeep
git commit -m "chore: create directory placeholders for scaffold"
```

---

## Task 5: Select pinned `microsoft/pxt` SHA

**Files:** none (interactive task; produces a SHA the next task pins)

The submodule must be pinned to a SHA that is at least 7 days old (SPEC §4.5). This task surfaces candidate SHAs; you (the user) pick one.

- [ ] **Step 1: List 30 most recent commits on `microsoft/pxt`'s `master`**

Run:

```bash
git ls-remote https://github.com/microsoft/pxt master > /dev/null  # warm DNS
mkdir -p /tmp/pxt-sha-pick
cd /tmp/pxt-sha-pick
git clone --depth 50 --filter=blob:none --no-checkout https://github.com/microsoft/pxt master-only 2>/dev/null || (cd master-only && git fetch --depth 50 origin master)
cd master-only
git log --since='180 days ago' --until='7 days ago' --pretty=format:'%h %ai %s' -30 origin/master
cd -
```

Expected: prints up to 30 short SHAs with ISO timestamps and commit subjects, all at least 7 days old. The newest line is the freshest candidate.

- [ ] **Step 2: Present the top 3 candidates to the user**

Show the three newest lines from Step 1's output. Ask which SHA to pin (or accept the newest by default). Wait for user input.

- [ ] **Step 3: Capture the chosen full SHA**

```bash
cd /tmp/pxt-sha-pick/master-only
git rev-parse <SHORT_SHA_FROM_USER>
cd -
```

Expected: prints the full 40-char SHA. Record it as `PXT_SHA` for Task 6.

(No commit in this task — selection is an interactive decision, not a code change.)

---

## Task 6: Add `vendor/pxt` submodule pinned to the chosen SHA

**Files:**
- Create: `.gitmodules`
- Create: `vendor/pxt` (submodule entry)

- [ ] **Step 1: Add the submodule**

From the worktree root:

```bash
git submodule add https://github.com/microsoft/pxt vendor/pxt
```

Expected: clones `microsoft/pxt` into `vendor/pxt/`. Creates `.gitmodules`. May take 1–3 minutes (pxt is a large repo).

- [ ] **Step 2: Check out the chosen SHA**

Replace `<PXT_SHA>` with the full SHA from Task 5 step 3:

```bash
cd vendor/pxt
git checkout <PXT_SHA>
cd ../..
```

Expected: detaches HEAD at the chosen commit. `git -C vendor/pxt rev-parse HEAD` returns `<PXT_SHA>`.

- [ ] **Step 3: Verify `kiosk/` is present in the submodule**

Run: `ls vendor/pxt/kiosk/src/ | head -5`
Expected: lists files like `App.tsx`, `Components/`, etc. (proves the SHA is one where `kiosk/` exists).

- [ ] **Step 4: Verify nothing inside the submodule is staged**

Run: `git status`
Expected: shows `new file: .gitmodules` and `new file: vendor/pxt` (submodule pointer). Crucially, no individual files under `vendor/pxt/` should be listed.

- [ ] **Step 5: Commit**

Replace `<PXT_SHORT_SHA>` (first 7 chars of the chosen SHA):

```bash
git add .gitmodules vendor/pxt
git commit -m "chore(submodule): pin pxt to <PXT_SHORT_SHA>"
```

---

## Task 7: Write failing tests for `pxt-stub.js`

**Files:**
- Create: `tests/pxt-stub.test.js`

Tests are written first; the override file follows in Task 8. Each test covers a specific requirement from SPEC §6.1.

- [ ] **Step 1: Create the test file**

```javascript
/**
 * @jest-environment jsdom
 */

'use strict';

function loadStub() {
  jest.resetModules();
  // The stub is plain browser JS — re-require to re-run its IIFE.
  // require returns module.exports (empty), but the side effect is what we want.
  require('../overrides/public/pxt-stub.js');
}

beforeEach(() => {
  delete window.pxt;
  delete window.__pxtStubStats;
  // Default fetch mock — tests override per case.
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    })
  );
});

describe('pxt-stub', () => {
  test('defines window.pxt if not already present', () => {
    loadStub();
    expect(window.pxt).toBeDefined();
    expect(typeof window.pxt.targetConfigAsync).toBe('function');
  });

  test('does not override window.pxt if already present', () => {
    window.pxt = { sentinel: 'preexisting' };
    loadStub();
    expect(window.pxt).toEqual({ sentinel: 'preexisting' });
  });

  test('tickEvent is callable and returns undefined', () => {
    loadStub();
    expect(window.pxt.tickEvent('ui.kiosk.start')).toBeUndefined();
  });

  test('tickEvent does NOT expose stats when DEBUG=false', () => {
    loadStub();
    window.pxt.tickEvent('x');
    expect(window.__pxtStubStats).toBeUndefined();
  });

  test('Cloud.apiRoot is about:blank (no network)', () => {
    loadStub();
    expect(window.pxt.Cloud.apiRoot).toBe('about:blank');
  });

  test('Util.escapeForRegex escapes regex metacharacters', () => {
    loadStub();
    expect(window.pxt.Util.escapeForRegex('a.b*c')).toBe('a\\.b\\*c');
    expect(window.pxt.Util.escapeForRegex('foo')).toBe('foo');
  });

  test('targetConfigAsync returns { kiosk: { games } } from games.json', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ games: [{ id: '1', name: 'X' }] }),
      })
    );
    loadStub();
    const cfg = await window.pxt.targetConfigAsync();
    expect(cfg).toEqual({ kiosk: { games: [{ id: '1', name: 'X' }] } });
  });

  test('targetConfigAsync caches its result', async () => {
    loadStub();
    await window.pxt.targetConfigAsync();
    await window.pxt.targetConfigAsync();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('targetConfigAsync returns empty games on fetch failure', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('boom')));
    loadStub();
    const cfg = await window.pxt.targetConfigAsync();
    expect(cfg).toEqual({ kiosk: { games: [] } });
  });

  test('targetConfigAsync returns empty games on non-OK HTTP', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
    );
    loadStub();
    const cfg = await window.pxt.targetConfigAsync();
    expect(cfg).toEqual({ kiosk: { games: [] } });
  });

  test('reportError increments local counter and logs', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadStub();
    window.pxt.reportError('cat', 'msg');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  test('reportException increments local counter and logs', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadStub();
    window.pxt.reportException(new Error('x'));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx jest tests/pxt-stub.test.js`
Expected: FAIL — Jest errors because `overrides/public/pxt-stub.js` does not exist.

- [ ] **Step 3: Commit**

```bash
git add tests/pxt-stub.test.js
git commit -m "test: add failing tests for pxt-stub override"
```

---

## Task 8: Implement `overrides/public/pxt-stub.js` to pass tests

**Files:**
- Create: `overrides/public/pxt-stub.js`
- Delete: `overrides/public/.gitkeep`

Implementation per SPEC §4.10. The `%MKC_DEBUG%` literal stays in the source; `apply-overrides.sh` (Task 12) substitutes it at copy-time.

- [ ] **Step 1: Create the override file**

```javascript
// pxt-stub.js — stub the upstream `pxt` global so mkc-arcade-kiosk runs
// standalone without the rest of the PXT framework.
//
// Responsibilities:
//   1. Provide pxt.targetConfigAsync() that returns our games from games.json.
//   2. Provide no-op telemetry (configurable for debugging).
//   3. Provide minimal Util helpers that Kiosk references.
//   4. Disable backend cloud calls (Kiosk ID flow is unused — we own the list).
//
// Load order: this MUST load before native-gamepad-bridge.js and before the
// CRA bundle, because Kiosk's App.tsx calls pxt.targetConfigAsync() on mount.
(function () {
  'use strict';

  if (window.pxt) {
    console.warn('[pxt-stub] window.pxt already exists; not overriding');
    return;
  }

  // ---- Debug toggle -----------------------------------------------------
  // Set via build-time env var MKC_DEBUG=true OR by adding ?mkcDebug=1 to URL.
  // When enabled, telemetry calls log to console and increment counters
  // accessible at window.__pxtStubStats.
  var DEBUG = (function () {
    try {
      // Build-time substitution placeholder. apply-overrides.sh replaces
      // %MKC_DEBUG% with the environment variable value at copy time.
      var fromEnv = ('%MKC_DEBUG%' === 'true');
      var fromUrl = /[?&]mkcDebug=1\b/.test(location.search);
      return fromEnv || fromUrl;
    } catch (e) { return false; }
  })();

  var stats = {
    tickEventCount: 0,
    reportErrorCount: 0,
    reportExceptionCount: 0,
    eventsByName: {},
  };

  if (DEBUG) {
    window.__pxtStubStats = stats;
    console.log('[pxt-stub] DEBUG enabled — stats at window.__pxtStubStats');
  }

  function tick(category) {
    stats.tickEventCount++;
    stats.eventsByName[category] = (stats.eventsByName[category] || 0) + 1;
    if (DEBUG) console.debug('[pxt.tickEvent]', category);
  }

  // ---- targetConfigAsync ------------------------------------------------
  // Kiosk's App.tsx calls this on mount and expects { kiosk: { games: [...] } }.
  // We resolve the path relative to document.baseURI so it works on:
  //   - GitHub Pages project URL: greglamb.github.io/mkc-arcade-kiosk/
  //   - Any custom domain
  //   - file:// URL when bundled inside a native shell
  var cachedConfig = null;
  function targetConfigAsync() {
    if (cachedConfig) return Promise.resolve(cachedConfig);
    var url = new URL('games.json', document.baseURI).href;
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('games.json HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var games = (data && Array.isArray(data.games)) ? data.games : [];
        if (DEBUG) console.log('[pxt-stub] loaded', games.length, 'games');
        cachedConfig = { kiosk: { games: games } };
        return cachedConfig;
      })
      .catch(function (err) {
        console.error('[pxt-stub] games.json load failed:', err);
        cachedConfig = { kiosk: { games: [] } };
        return cachedConfig;
      });
  }

  // ---- The stub ---------------------------------------------------------
  window.pxt = {
    targetConfigAsync: targetConfigAsync,
    tickEvent: function (cat) { tick(cat); },
    debug: function () { if (DEBUG) console.debug.apply(console, arguments); },
    log:   function () { if (DEBUG) console.log.apply(console, arguments); },
    reportError: function (cat, msg) {
      stats.reportErrorCount++;
      console.error('[pxt.reportError]', cat, msg);
    },
    reportException: function (e) {
      stats.reportExceptionCount++;
      console.error('[pxt.reportException]', e);
    },
    // Kiosk's BackendRequests.ts uses pxt.Cloud.apiRoot to talk to Microsoft's
    // kiosk code service. We point it at about:blank so any accidental
    // invocation fails loudly rather than leaking data.
    Cloud: { apiRoot: 'about:blank' },
    Util: {
      escapeForRegex: function (s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      },
    },
  };

  if (DEBUG) console.log('[pxt-stub] installed');
})();
```

- [ ] **Step 2: Run the tests, expect green**

Run: `npx jest tests/pxt-stub.test.js`
Expected: PASS for all twelve tests.

- [ ] **Step 3: Remove the now-redundant placeholder**

Run: `rm overrides/public/.gitkeep`

- [ ] **Step 4: Commit**

```bash
git add overrides/public/pxt-stub.js
git rm overrides/public/.gitkeep
git commit -m "feat(overrides): add pxt-stub.js to replace upstream PXT global"
```

---

## Task 9: Write failing tests for `native-gamepad-bridge.js`

**Files:**
- Create: `tests/native-gamepad-bridge.test.js`

Tests cover SPEC §6.2 requirements.

- [ ] **Step 1: Create the test file**

```javascript
/**
 * @jest-environment jsdom
 */

'use strict';

function loadBridge() {
  jest.resetModules();
  require('../overrides/public/native-gamepad-bridge.js');
}

function rawPad(overrides) {
  return Object.assign(
    {
      id: 'Test Pad',
      buttons: new Array(17).fill(0),
      axes: [0, 0, 0, 0],
    },
    overrides || {}
  );
}

beforeEach(() => {
  delete window.webkit;
  delete window.__nativeGamepadUpdate;
  // Restore the real getGamepads if a previous test overrode it.
  if (navigator.getGamepads && navigator.getGamepads.__bridgePolyfill) {
    delete navigator.getGamepads;
  }
});

describe('native-gamepad-bridge', () => {
  test('no-ops when window.webkit.messageHandlers.gameController is undefined', () => {
    loadBridge();
    expect(window.__nativeGamepadUpdate).toBeUndefined();
  });

  test('installs polyfill when native shell handler is present', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    expect(typeof window.__nativeGamepadUpdate).toBe('function');
    expect(typeof navigator.getGamepads).toBe('function');
  });

  test('signals polyfill_ready to the native bridge', () => {
    const postMessage = jest.fn();
    window.webkit = { messageHandlers: { gameController: { postMessage } } };
    loadBridge();
    expect(postMessage).toHaveBeenCalledWith({ type: 'polyfill_ready' });
  });

  test('navigator.getGamepads returns an array of length 4', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const pads = navigator.getGamepads();
    expect(Array.isArray(pads)).toBe(true);
    expect(pads).toHaveLength(4);
  });

  test('all slots are null before any update', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    expect(navigator.getGamepads()).toEqual([null, null, null, null]);
  });

  test('update populates slot 0 when a single pad is sent', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    window.__nativeGamepadUpdate([rawPad(), null, null, null]);
    const pads = navigator.getGamepads();
    expect(pads[0]).not.toBeNull();
    expect(pads[0].mapping).toBe('standard');
    expect(pads[0].connected).toBe(true);
    expect(pads[1]).toBeNull();
  });

  test('null → object slot transition dispatches gamepadconnected', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const onConnect = jest.fn();
    window.addEventListener('gamepadconnected', onConnect);
    window.__nativeGamepadUpdate([rawPad(), null, null, null]);
    expect(onConnect).toHaveBeenCalledTimes(1);
    const evt = onConnect.mock.calls[0][0];
    expect(evt.gamepad.index).toBe(0);
  });

  test('object → null slot transition dispatches gamepaddisconnected', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const onDisconnect = jest.fn();
    window.addEventListener('gamepaddisconnected', onDisconnect);
    window.__nativeGamepadUpdate([rawPad(), null, null, null]);
    window.__nativeGamepadUpdate([null, null, null, null]);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  test('button value > 0.5 reports pressed=true', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const buttons = new Array(17).fill(0);
    buttons[0] = 0.7;
    buttons[1] = 0.4;
    window.__nativeGamepadUpdate([rawPad({ buttons }), null, null, null]);
    const pad = navigator.getGamepads()[0];
    expect(pad.buttons[0].pressed).toBe(true);
    expect(pad.buttons[0].value).toBe(0.7);
    expect(pad.buttons[1].pressed).toBe(false);
    expect(pad.buttons[1].value).toBe(0.4);
  });

  test('accepts JSON string payload', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const payload = JSON.stringify([rawPad(), null, null, null]);
    window.__nativeGamepadUpdate(payload);
    expect(navigator.getGamepads()[0]).not.toBeNull();
  });

  test('malformed payload logs but does not throw', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => window.__nativeGamepadUpdate('{not json')).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx jest tests/native-gamepad-bridge.test.js`
Expected: FAIL — `overrides/public/native-gamepad-bridge.js` does not exist.

- [ ] **Step 3: Commit**

```bash
git add tests/native-gamepad-bridge.test.js
git commit -m "test: add failing tests for native-gamepad-bridge"
```

---

## Task 10: Implement `overrides/public/native-gamepad-bridge.js` to pass tests

**Files:**
- Create: `overrides/public/native-gamepad-bridge.js`

Implementation per SPEC §4.11.

- [ ] **Step 1: Create the override file**

```javascript
// native-gamepad-bridge.js — bridges a host WebView's native game controllers
// into the page's navigator.getGamepads() API.
//
// In a regular browser, this script no-ops and the real Gamepad API is used.
// In a native shell (detected via window.webkit.messageHandlers.gameController),
// it overrides getGamepads() and the host pushes state via __nativeGamepadUpdate.
//
// Load order: this MUST load before the CRA bundle, because Kiosk's
// GamepadManager.initialize() calls getGamepads() once at startup.
(function () {
  'use strict';

  var HANDLER_NAME = 'gameController';
  var bridge = window.webkit
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers[HANDLER_NAME];

  if (!bridge) {
    // No native shell. Let the real Gamepad API work normally.
    return;
  }

  console.log('[native-gamepad-bridge] Installing (native shell detected)');

  var MAX_PADS = 4;
  var padStates = new Array(MAX_PADS).fill(null);

  /**
   * Build a W3C Standard Gamepad object from a raw state payload.
   *
   * The native side sends:
   *   {
   *     id: string,            // human-readable name
   *     buttons: number[17],   // each 0..1, standard mapping order
   *     axes:    number[4]     // each -1..+1, [leftX, leftY, rightX, rightY]
   *   }
   *
   * Standard button index reference (W3C Gamepad spec):
   *   0=A, 1=B, 2=X, 3=Y,
   *   4=L1, 5=R1, 6=L2, 7=R2,
   *   8=Select/Back, 9=Start,
   *   10=L3, 11=R3,
   *   12=DPadUp, 13=DPadDown, 14=DPadLeft, 15=DPadRight,
   *   16=Home/Guide
   */
  function build(index, raw) {
    return {
      id: raw.id || ('Native Controller ' + index + ' (STANDARD GAMEPAD)'),
      index: index,
      connected: true,
      mapping: 'standard',
      timestamp: performance.now(),
      buttons: raw.buttons.map(function (v) {
        return {
          pressed: v > 0.5,
          touched: v > 0.0,
          value: v,
        };
      }),
      axes: raw.axes.slice(0, 4),
      vibrationActuator: null,
      hapticActuators: [],
    };
  }

  /**
   * Native shell calls this on every controller state change.
   * Accepts JSON string or pre-parsed array of length MAX_PADS.
   * Fires gamepadconnected/gamepaddisconnected events on slot transitions.
   */
  window.__nativeGamepadUpdate = function (payload) {
    try {
      var incoming = typeof payload === 'string' ? JSON.parse(payload) : payload;
      for (var i = 0; i < MAX_PADS; i++) {
        var prev = padStates[i];
        var next = incoming[i] ? build(i, incoming[i]) : null;

        if (!prev && next) {
          window.dispatchEvent(new GamepadEvent('gamepadconnected', { gamepad: next }));
        } else if (prev && !next) {
          window.dispatchEvent(new GamepadEvent('gamepaddisconnected', { gamepad: prev }));
        }
        padStates[i] = next;
      }
    } catch (e) {
      console.error('[native-gamepad-bridge] update failed:', e);
    }
  };

  // Override the Gamepad API. Kiosk's GamepadManager polls this every
  // GamepadPollLoopMilli (50ms by default).
  navigator.getGamepads = function () { return padStates; };

  // Signal native that the polyfill is ready and it can push initial state.
  try {
    bridge.postMessage({ type: 'polyfill_ready' });
  } catch (e) {
    console.error('[native-gamepad-bridge] ready signal failed:', e);
  }
})();
```

- [ ] **Step 2: Verify jsdom has `GamepadEvent`**

jsdom does not ship `GamepadEvent` by default; tests need a polyfill. Add a setup file:

Create: `tests/setup-gamepad-event.js`

```javascript
'use strict';

// jsdom doesn't implement GamepadEvent; provide a minimal stand-in.
if (typeof GamepadEvent === 'undefined') {
  global.GamepadEvent = class GamepadEvent extends Event {
    constructor(type, init) {
      super(type, init);
      this.gamepad = (init && init.gamepad) || null;
    }
  };
}
```

Then modify `package.json` `jest` block to add `setupFiles`. Replace the `jest` section with:

```json
  "jest": {
    "testEnvironment": "jsdom",
    "testMatch": ["<rootDir>/tests/**/*.test.js"],
    "setupFiles": ["<rootDir>/tests/setup-gamepad-event.js"],
    "collectCoverageFrom": [
      "overrides/**/*.js",
      "scripts/**/*.js"
    ],
    "coverageThreshold": {
      "global": {
        "branches": 75,
        "functions": 75,
        "lines": 75,
        "statements": 75
      }
    }
  }
```

(Use Edit to change only the `"jest": { ... }` block; don't rewrite the whole `package.json`.)

- [ ] **Step 3: Run the tests, expect green**

Run: `npx jest tests/native-gamepad-bridge.test.js`
Expected: PASS for all eleven tests.

- [ ] **Step 4: Commit**

```bash
git add overrides/public/native-gamepad-bridge.js tests/setup-gamepad-event.js package.json
git commit -m "feat(overrides): add native-gamepad-bridge polyfill"
```

---

## Task 11: Write failing tests + `overrides/games.json` + `overrides/README.md`

**Files:**
- Create: `tests/games-json.test.js`
- Create: `overrides/games.json`
- Create: `overrides/README.md`

Tests use Ajv to validate the schema (SPEC §6.3). `games.json` is a static asset, not code with behavior — so the "RED → GREEN" happens by writing the test against a non-existent file (test fails because the JSON file is missing), then creating the JSON file.

- [ ] **Step 1: Write the test**

Create `tests/games-json.test.js`:

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const SHARE_ID = /^\d{5}-\d{5}-\d{5}-\d{5}$/;
const PERSISTENT_ID = /^_[a-zA-Z0-9]+$/;

const schema = {
  type: 'object',
  required: ['games'],
  properties: {
    $schema: { type: 'string' },
    _comment: { type: 'string' },
    games: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'name', 'description', 'highScoreMode'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          highScoreMode: { enum: ['SingleAscending', 'None'] },
        },
        additionalProperties: false,
      },
      minItems: 1,
    },
  },
  additionalProperties: false,
};

let data;
beforeAll(() => {
  const text = fs.readFileSync(
    path.join(__dirname, '..', 'overrides', 'games.json'),
    'utf8'
  );
  data = JSON.parse(text);
});

describe('overrides/games.json', () => {
  test('is valid JSON', () => {
    expect(data).toBeDefined();
  });

  test('matches the schema', () => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const ok = validate(data);
    if (!ok) {
      throw new Error(JSON.stringify(validate.errors, null, 2));
    }
    expect(ok).toBe(true);
  });

  test('every game id matches the share-ID or persistent-ID pattern', () => {
    for (const g of data.games) {
      const matchesShare = SHARE_ID.test(g.id);
      const matchesPersistent = PERSISTENT_ID.test(g.id);
      expect(matchesShare || matchesPersistent).toBe(true);
    }
  });

  test('every highScoreMode is in the allowed enum', () => {
    for (const g of data.games) {
      expect(['SingleAscending', 'None']).toContain(g.highScoreMode);
    }
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx jest tests/games-json.test.js`
Expected: FAIL — `overrides/games.json` does not exist (`ENOENT`).

- [ ] **Step 3: Create `overrides/games.json` per SPEC §4.12**

```json
{
  "$schema": "./games.schema.json",
  "_comment": "Example starter list. Replace with your son's games. Get game IDs by opening a game on arcade.makecode.com, clicking Share, publishing, and copying the ID from the URL (the 20-digit XXXXX-XXXXX-XXXXX-XXXXX format or the _abcdef persistent ID).",
  "games": [
    {
      "id": "50225-04801-24334-14778",
      "name": "Space Destroyer",
      "description": "Use the lasers on your spaceship to shoot falling asteroids!",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "91201-59331-72477-53174",
      "name": "Bunny Hop!",
      "description": "Help your bunny hop over obstacles as they run through the forest",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "27640-75402-47530-91242",
      "name": "Hot Air Balloon",
      "description": "Navigate your hot air balloon through the mountains avoiding birds and spaceships",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "19410-44885-95661-59850",
      "name": "Save the Forest",
      "description": "Fly your plane over the forest spraying water to put out the fires!",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "91782-54072-13194-99228",
      "name": "Caterpillar",
      "description": "Eat the leaves to grow, but watch out for walls!",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "96744-30917-11312-43375",
      "name": "Falling Duck",
      "description": "Fly through the sky avoiding obstacles",
      "highScoreMode": "None"
    }
  ]
}
```

- [ ] **Step 4: Create `overrides/README.md` per SPEC §4.13**

```markdown
# overrides/

This directory holds all customizations applied to the upstream `microsoft/pxt`
submodule at build time. Never edit files inside `vendor/pxt/` — they will be
overwritten on the next build and any changes you make there will be lost when
the submodule is bumped.

## Files

- `public/native-gamepad-bridge.js` — gamepad API polyfill for native shells
- `public/pxt-stub.js` — replaces the upstream `pxt` global, serves games.json
- `games.json` — the kiosk's game list (THE file you edit most often)

## Adding a game

1. Open the game on [arcade.makecode.com](https://arcade.makecode.com)
2. Click **Share**, give it a title, click **Share Project**
3. Copy the share ID from the URL (after `arcade.makecode.com/`)
4. Add an entry to `games.json`:

```json
{
  "id": "12345-67890-12345-67890",
  "name": "Display name",
  "description": "One-sentence description",
  "highScoreMode": "SingleAscending"
}
```

5. Commit and push. The Pages workflow rebuilds automatically.

## Removing a game

Just remove its entry from `games.json` and push.
```

- [ ] **Step 5: Run the tests, expect green**

Run: `npx jest tests/games-json.test.js`
Expected: PASS for all four tests.

- [ ] **Step 6: Commit**

```bash
git add tests/games-json.test.js overrides/games.json overrides/README.md
git commit -m "feat(overrides): add games.json starter list and schema tests"
```

---

## Task 12: Implement `scripts/inject-html.js` (Node-based `<script>` injection)

**Files:**
- Create: `scripts/inject-html.js`
- Create: `tests/inject-html.test.js`

Replaces the macOS-fragile multi-line `sed` from SPEC §4.8. Writing as a standalone Node script so it's directly testable. Called by `apply-overrides.sh` in Task 13.

- [ ] **Step 1: Write the failing test**

Create `tests/inject-html.test.js`:

```javascript
/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { injectScripts } = require('../scripts/inject-html.js');

function makeFixture(html) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-html-'));
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html, 'utf8');
  return file;
}

const BASE_HTML = '<html><head>\n  <title>Kiosk</title>\n</head><body></body></html>';
const MARKER = '<!-- mkc-arcade-kiosk injected -->';

describe('injectScripts', () => {
  test('inserts marker and two script tags before </head>', () => {
    const file = makeFixture(BASE_HTML);
    injectScripts(file);
    const out = fs.readFileSync(file, 'utf8');
    expect(out).toContain(MARKER);
    expect(out).toContain('%PUBLIC_URL%/pxt-stub.js');
    expect(out).toContain('%PUBLIC_URL%/native-gamepad-bridge.js');
    const markerIdx = out.indexOf(MARKER);
    const headCloseIdx = out.indexOf('</head>');
    expect(markerIdx).toBeLessThan(headCloseIdx);
  });

  test('inserts pxt-stub.js BEFORE native-gamepad-bridge.js (load order matters)', () => {
    const file = makeFixture(BASE_HTML);
    injectScripts(file);
    const out = fs.readFileSync(file, 'utf8');
    const stubIdx = out.indexOf('pxt-stub.js');
    const bridgeIdx = out.indexOf('native-gamepad-bridge.js');
    expect(stubIdx).toBeGreaterThan(-1);
    expect(bridgeIdx).toBeGreaterThan(stubIdx);
  });

  test('is idempotent — second call leaves content unchanged', () => {
    const file = makeFixture(BASE_HTML);
    injectScripts(file);
    const afterFirst = fs.readFileSync(file, 'utf8');
    injectScripts(file);
    const afterSecond = fs.readFileSync(file, 'utf8');
    expect(afterSecond).toBe(afterFirst);
  });

  test('throws when </head> is missing', () => {
    const file = makeFixture('<html><body></body></html>');
    expect(() => injectScripts(file)).toThrow(/<\/head>/);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx jest tests/inject-html.test.js`
Expected: FAIL — `scripts/inject-html.js` does not exist.

- [ ] **Step 3: Implement the script**

Create `scripts/inject-html.js`:

```javascript
'use strict';

// Idempotently insert the mkc-arcade-kiosk override <script> tags into the
// kiosk app's index.html, just before </head>. Replaces the multi-line `sed`
// approach from SPEC §4.8 because BSD sed (macOS) and GNU sed (CI) disagree
// on multi-line replacement semantics; Node is portable and already a build
// dependency.
//
// Load order matters: pxt-stub.js must come before native-gamepad-bridge.js,
// and both must come before the CRA bundle.

const fs = require('fs');

const MARKER = '<!-- mkc-arcade-kiosk injected -->';

const INJECTION = [
  '    ' + MARKER,
  '    <script src="%PUBLIC_URL%/pxt-stub.js"></script>',
  '    <script src="%PUBLIC_URL%/native-gamepad-bridge.js"></script>',
  '  ',
].join('\n');

function injectScripts(indexHtmlPath) {
  const original = fs.readFileSync(indexHtmlPath, 'utf8');

  if (original.includes(MARKER)) {
    // Already injected — no-op for idempotency.
    return;
  }

  const headCloseIdx = original.indexOf('</head>');
  if (headCloseIdx === -1) {
    throw new Error(
      'inject-html: could not find </head> in ' + indexHtmlPath
    );
  }

  const updated =
    original.slice(0, headCloseIdx) +
    INJECTION +
    original.slice(headCloseIdx);

  fs.writeFileSync(indexHtmlPath, updated, 'utf8');
}

module.exports = { injectScripts, MARKER };

// CLI entry: `node scripts/inject-html.js <path-to-index.html>`
if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: inject-html.js <path-to-index.html>');
    process.exit(2);
  }
  injectScripts(target);
}
```

- [ ] **Step 4: Run the tests, expect green**

Run: `npx jest tests/inject-html.test.js`
Expected: PASS for all four tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/inject-html.js tests/inject-html.test.js
git commit -m "feat(scripts): add Node-based index.html script injector"
```

---

## Task 13: Implement `scripts/apply-overrides.sh` with the §4.10 substitution merged

**Files:**
- Create: `scripts/apply-overrides.sh`
- Create: `tests/apply-overrides.test.js`
- Delete: `scripts/.gitkeep`

Per SPEC §4.8 and §4.10. The `%MKC_DEBUG%` substitution from the §4.10 callout is merged into this single script (spec bug #2 fix). The `index.html` injection uses Node (Task 12) instead of multi-line sed (spec bug #3 fix). The `homepage` patch stays as Node.

- [ ] **Step 1: Write the failing test**

Create `tests/apply-overrides.test.js`:

```javascript
/**
 * @jest-environment node
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'apply-overrides.sh');
const ROOT_REAL = path.resolve(__dirname, '..');

function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mkc-fake-'));
  // Mirror only what apply-overrides.sh needs: overrides/ and vendor/pxt/kiosk/.
  fs.mkdirSync(path.join(root, 'overrides', 'public'), { recursive: true });
  fs.mkdirSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });

  // Copy override sources from the real repo.
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'public', 'pxt-stub.js'),
    path.join(root, 'overrides', 'public', 'pxt-stub.js')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'public', 'native-gamepad-bridge.js'),
    path.join(root, 'overrides', 'public', 'native-gamepad-bridge.js')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'games.json'),
    path.join(root, 'overrides', 'games.json')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'scripts', 'apply-overrides.sh'),
    path.join(root, 'scripts', 'apply-overrides.sh')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'scripts', 'inject-html.js'),
    path.join(root, 'scripts', 'inject-html.js')
  );
  fs.chmodSync(path.join(root, 'scripts', 'apply-overrides.sh'), 0o755);

  // Fake kiosk package.json (minimum required fields).
  fs.writeFileSync(
    path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'),
    JSON.stringify({ name: 'pxt-kiosk', version: '0.0.0', homepage: 'OLD' }, null, 2) + '\n'
  );

  // Fake kiosk index.html.
  fs.writeFileSync(
    path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'),
    '<html><head>\n  <title>Kiosk</title>\n</head><body></body></html>'
  );

  return root;
}

function runScript(root, env = {}) {
  execFileSync(path.join(root, 'scripts', 'apply-overrides.sh'), [], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}

describe('apply-overrides.sh', () => {
  test('copies override files into vendor/pxt/kiosk/public/', () => {
    const root = makeFakeRoot();
    runScript(root);
    const kioskPublic = path.join(root, 'vendor', 'pxt', 'kiosk', 'public');
    expect(fs.existsSync(path.join(kioskPublic, 'pxt-stub.js'))).toBe(true);
    expect(fs.existsSync(path.join(kioskPublic, 'native-gamepad-bridge.js'))).toBe(true);
    expect(fs.existsSync(path.join(kioskPublic, 'games.json'))).toBe(true);
  });

  test('substitutes %MKC_DEBUG% with the env value (default false)', () => {
    const root = makeFakeRoot();
    runScript(root);
    const stub = fs.readFileSync(
      path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'),
      'utf8'
    );
    expect(stub).not.toContain('%MKC_DEBUG%');
    expect(stub).toContain("'false' === 'true'");
  });

  test('substitutes %MKC_DEBUG% with "true" when env says so', () => {
    const root = makeFakeRoot();
    runScript(root, { MKC_DEBUG: 'true' });
    const stub = fs.readFileSync(
      path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'),
      'utf8'
    );
    expect(stub).toContain("'true' === 'true'");
  });

  test('sets package.json homepage to "."', () => {
    const root = makeFakeRoot();
    runScript(root);
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'), 'utf8')
    );
    expect(pkg.homepage).toBe('.');
  });

  test('injects both <script> tags into index.html before </head>', () => {
    const root = makeFakeRoot();
    runScript(root);
    const html = fs.readFileSync(
      path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'),
      'utf8'
    );
    expect(html).toContain('<!-- mkc-arcade-kiosk injected -->');
    expect(html).toContain('pxt-stub.js');
    expect(html).toContain('native-gamepad-bridge.js');
  });

  test('is idempotent — running twice produces no further diff', () => {
    const root = makeFakeRoot();
    runScript(root);
    const snapshot = {
      stub: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'), 'utf8'),
      bridge: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'native-gamepad-bridge.js'), 'utf8'),
      games: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'games.json'), 'utf8'),
      pkg: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'), 'utf8'),
      html: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'), 'utf8'),
    };
    runScript(root);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'), 'utf8')).toBe(snapshot.stub);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'native-gamepad-bridge.js'), 'utf8')).toBe(snapshot.bridge);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'games.json'), 'utf8')).toBe(snapshot.games);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'), 'utf8')).toBe(snapshot.pkg);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'), 'utf8')).toBe(snapshot.html);
  });

  test('fails fast if the submodule is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mkc-empty-'));
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.copyFileSync(
      path.join(ROOT_REAL, 'scripts', 'apply-overrides.sh'),
      path.join(root, 'scripts', 'apply-overrides.sh')
    );
    fs.chmodSync(path.join(root, 'scripts', 'apply-overrides.sh'), 0o755);
    expect(() => runScript(root)).toThrow();
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `npx jest tests/apply-overrides.test.js`
Expected: FAIL — `scripts/apply-overrides.sh` does not exist.

- [ ] **Step 3: Implement the script**

Create `scripts/apply-overrides.sh`:

```bash
#!/usr/bin/env bash
# Idempotently copy our customizations into the pxt submodule's kiosk app
# so that `npm run build` produces our themed/instrumented kiosk.
#
# This script is safe to run multiple times. It does NOT modify the submodule
# in ways that would be staged for commit — submodule isolation handles that —
# but we add belt-and-suspenders .gitignore entries too.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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
```

Make it executable:

```bash
chmod +x scripts/apply-overrides.sh
```

- [ ] **Step 4: Run the tests, expect green**

Run: `npx jest tests/apply-overrides.test.js`
Expected: PASS for all seven tests.

- [ ] **Step 5: Remove the now-redundant placeholder**

```bash
git rm scripts/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add scripts/apply-overrides.sh tests/apply-overrides.test.js
git commit -m "feat(scripts): add apply-overrides.sh with merged %MKC_DEBUG% sub"
```

---

## Task 14: Implement `scripts/bump-submodule.sh`

**Files:**
- Create: `scripts/bump-submodule.sh`

Per SPEC §4.9. No Jest test — this script is purely a wrapper around `git` commands and is exercised manually or via Dependabot. The commit it produces is the verification.

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
# Bump the pxt submodule to the latest master and commit.
# Use sparingly — prefer Dependabot's monthly PR which gives you a diff to review.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/vendor/pxt"

git fetch origin master
OLD_SHA=$(git rev-parse --short HEAD)
git checkout origin/master
NEW_SHA=$(git rev-parse --short HEAD)

if [[ "$OLD_SHA" == "$NEW_SHA" ]]; then
  echo "Already at latest ($NEW_SHA). No bump needed."
  exit 0
fi

cd "$ROOT"
git add vendor/pxt
git commit -m "deps(pxt): bump submodule $OLD_SHA -> $NEW_SHA"

echo ""
echo "Bumped pxt: $OLD_SHA -> $NEW_SHA"
echo "Review with: cd vendor/pxt && git log --oneline $OLD_SHA..$NEW_SHA -- kiosk/ react-common/"
echo "Then push and let the workflow validate the build."
```

Make it executable:

```bash
chmod +x scripts/bump-submodule.sh
```

- [ ] **Step 2: Verify shebang and executable bit**

Run: `head -1 scripts/bump-submodule.sh && test -x scripts/bump-submodule.sh && echo OK`
Expected: prints `#!/usr/bin/env bash` and `OK`.

- [ ] **Step 3: Commit**

```bash
git add scripts/bump-submodule.sh
git commit -m "feat(scripts): add bump-submodule.sh helper"
```

---

## Task 15: Implement `.github/workflows/deploy.yml` with `MKC_DEBUG` hoisted

**Files:**
- Create: `.github/workflows/deploy.yml`

Per SPEC §4.7, **with the `MKC_DEBUG` env var hoisted from the *Build kiosk* step to the *Apply overrides* step** so the substitution sees the variable. This is the fix for spec bug #1.

- [ ] **Step 1: Create the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      MKC_DEBUG: ${{ vars.MKC_DEBUG || 'false' }}
    steps:
      - name: Checkout (with submodule)
        uses: actions/checkout@v4
        with:
          submodules: recursive

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: vendor/pxt/kiosk/package-lock.json

      - name: Apply overrides
        run: ./scripts/apply-overrides.sh

      - name: Install kiosk deps
        working-directory: vendor/pxt/kiosk
        run: npm ci

      - name: Build kiosk
        working-directory: vendor/pxt/kiosk
        env:
          CI: false
        run: npm run build

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: vendor/pxt/kiosk/build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate YAML**

Run: `node -e "require('child_process').execSync('npx --yes js-yaml .github/workflows/deploy.yml > /dev/null')"`
Expected: exits 0 (YAML parses).

(If `js-yaml` isn't already a transitive dep, this will install it on-the-fly via `npx`. Acceptable for one-time validation.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow with MKC_DEBUG at job level"
```

---

## Task 16: Implement `.github/dependabot.yml`

**Files:**
- Create: `.github/dependabot.yml`

Per SPEC §4.6.

- [ ] **Step 1: Create the file**

```yaml
version: 2
updates:
  - package-ecosystem: gitsubmodule
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 1
    commit-message:
      prefix: "deps(pxt)"
    labels:
      - "dependencies"
      - "submodule"

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: monthly
    open-pull-requests-limit: 1
    commit-message:
      prefix: "ci"
    labels:
      - "dependencies"
      - "ci"
```

- [ ] **Step 2: Validate YAML**

Run: `npx --yes js-yaml .github/dependabot.yml > /dev/null && echo OK`
Expected: prints `OK`.

- [ ] **Step 3: Remove the now-redundant placeholder**

```bash
git rm .github/workflows/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci: add Dependabot config for monthly submodule + actions bumps"
```

---

## Task 17: Local build validation

**Files:** none (validation only)

This task runs the real build end-to-end to confirm the scaffold actually works against the pinned upstream Kiosk. No new code; either it passes or we have a real bug to investigate (in which case stop and report — do not fudge).

- [ ] **Step 1: Initialize the submodule**

Run: `npm run submodule:init`
Expected: prints submodule status. `vendor/pxt/kiosk/` populated.

- [ ] **Step 2: Apply overrides**

Run: `./scripts/apply-overrides.sh`
Expected: prints `==> Done`. The five copied files exist under `vendor/pxt/kiosk/public/` (and `package.json` for `homepage`).

- [ ] **Step 3: Verify `%MKC_DEBUG%` was substituted**

Run: `grep -c "%MKC_DEBUG%" vendor/pxt/kiosk/public/pxt-stub.js`
Expected: `0`.

- [ ] **Step 4: Verify the script tags are present in `index.html`**

Run: `grep -E "(pxt-stub|native-gamepad-bridge)\.js" vendor/pxt/kiosk/public/index.html`
Expected: prints both `<script>` tags.

- [ ] **Step 5: Install kiosk deps**

Run: `npm --prefix vendor/pxt/kiosk ci`
Expected: completes without errors. This may take 1–3 minutes.

- [ ] **Step 6: Run the kiosk build**

Run: `CI=false npm --prefix vendor/pxt/kiosk run build`
Expected: prints `Compiled successfully` (warnings about deprecated APIs from CRA are acceptable). Build output appears under `vendor/pxt/kiosk/build/`.

- [ ] **Step 7: Verify build artifacts**

Run:

```bash
test -f vendor/pxt/kiosk/build/index.html && \
test -f vendor/pxt/kiosk/build/pxt-stub.js && \
test -f vendor/pxt/kiosk/build/native-gamepad-bridge.js && \
test -f vendor/pxt/kiosk/build/games.json && \
echo OK
```

Expected: prints `OK`.

- [ ] **Step 8: Confirm the build's `pxt-stub.js` does NOT contain `%MKC_DEBUG%`**

Run: `grep -c "%MKC_DEBUG%" vendor/pxt/kiosk/build/pxt-stub.js`
Expected: `0`.

- [ ] **Step 9: Confirm idempotency: run apply-overrides twice, no change**

```bash
./scripts/apply-overrides.sh
SNAP=$(sha256sum vendor/pxt/kiosk/public/index.html vendor/pxt/kiosk/public/pxt-stub.js vendor/pxt/kiosk/public/games.json vendor/pxt/kiosk/public/native-gamepad-bridge.js 2>/dev/null || shasum -a 256 vendor/pxt/kiosk/public/index.html vendor/pxt/kiosk/public/pxt-stub.js vendor/pxt/kiosk/public/games.json vendor/pxt/kiosk/public/native-gamepad-bridge.js)
./scripts/apply-overrides.sh
SNAP2=$(sha256sum vendor/pxt/kiosk/public/index.html vendor/pxt/kiosk/public/pxt-stub.js vendor/pxt/kiosk/public/games.json vendor/pxt/kiosk/public/native-gamepad-bridge.js 2>/dev/null || shasum -a 256 vendor/pxt/kiosk/public/index.html vendor/pxt/kiosk/public/pxt-stub.js vendor/pxt/kiosk/public/games.json vendor/pxt/kiosk/public/native-gamepad-bridge.js)
test "$SNAP" = "$SNAP2" && echo IDEMPOTENT
```

Expected: prints `IDEMPOTENT`.

- [ ] **Step 10: Confirm `vendor/pxt` has no staged changes**

Run: `git status vendor/pxt`
Expected: shows nothing staged. The submodule pointer matches the pinned SHA from Task 6.

No commit in this task — it's a validation pass. If anything fails, stop and investigate per `goodvibes:systematic-debugging`.

---

## Task 18: Run the full Jest suite with coverage

**Files:** none (validation only)

Final gate. Confirms the entire test suite is green and coverage meets the 75% threshold from `project-standards`.

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: All test files pass. Coverage summary shows ≥75% on `overrides/**/*.js` and `scripts/**/*.js`. Exit code 0.

- [ ] **Step 2: If coverage is below threshold, identify gaps and add targeted tests**

If `npm test` reports a coverage failure, the output names the uncovered lines. Add tests under `tests/` that exercise those lines specifically, then re-run. Commit each gap-filler test as `test: cover <area>`. Do not lower the threshold.

- [ ] **Step 3: (If applicable) commit any added gap-filler tests**

```bash
git add tests/
git commit -m "test: raise coverage to threshold"
```

(Skip this step if Step 1 already passed.)

---

## Plan complete

When all 18 tasks are checked off:

- `npm run dev` opens a working local dev server.
- `npm run build` produces a working `vendor/pxt/kiosk/build/`.
- `npm test` is green with ≥75% coverage.
- `apply-overrides.sh` is idempotent and free of `%MKC_DEBUG%` leakage in build output.
- `vendor/pxt` has no staged changes.

Hand-off to the user (out of plan scope, per design doc §10):

1. `gh repo create greglamb/mkc-arcade-kiosk --public --source=. --remote=origin --push`
2. GitHub Settings → Pages → Source: **GitHub Actions**.
3. Wait for the deploy workflow's first green run.
4. Open the deployed URL; verify the six starter games render and the controller works.
5. Tag the release: `git tag -a "v0.YYMM.DDBB" -m "Initial release" && git push origin --tags`.
6. (Optional) Open a PR back to `mkc-arcade-kiosk-SPEC.md` documenting the two spec bugs fixed during this scaffold (workflow env hoist, sed → Node injection).

When merging the worktree back to `main`, run `goodvibes:finishing-a-development-branch`.
