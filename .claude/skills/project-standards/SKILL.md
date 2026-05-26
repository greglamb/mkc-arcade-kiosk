---
name: project-standards
description: Authoritative conventions, architecture rules, and coding standards for the mkc-arcade-kiosk repository. MUST be read before any change is brainstormed, planned, or implemented in this repo — including documentation, build scripts, override files, CI workflows, the games list, or anything that touches the vendor/pxt submodule. Use whenever the user mentions the kiosk, overrides, the pxt submodule, the gamepad bridge, games.json, the GitHub Pages deploy, the CalVer version, the apply-overrides script, or any structural decision about this project. Use even if the user asks a "small" question — the submodule isolation rule is easy to violate by accident and the consequences (orphaned upstream edits) are painful to unwind.
---

# mkc-arcade-kiosk — Project Standards

Authoritative source: `mkc-arcade-kiosk-SPEC.md` at the repo root. This skill summarizes its invariants in actionable form. When the SPEC and this skill disagree, the SPEC wins — fix this skill rather than working around it.

---

## The one rule that matters most

**Never commit changes inside `vendor/pxt/`.**

`vendor/pxt/` is a pinned git submodule of `microsoft/pxt`. All customizations to the kiosk live in `overrides/` at the repo root and are copied into the submodule at build time by `scripts/apply-overrides.sh`. The submodule itself stays pristine so that monthly Dependabot bumps merge cleanly.

If you find yourself editing a file under `vendor/pxt/`, **stop**. The right move is:

1. Identify the corresponding override path (typically `overrides/public/<filename>` or `overrides/<filename>`).
2. Make the change there.
3. Re-run `./scripts/apply-overrides.sh` to copy it into the submodule for local testing.
4. Commit only the override file, never the submodule's working copy.

Hook-and-belt protection: `.gitignore` blocks the staged versions of common override-destination paths inside the submodule. If git tries to stage a file under `vendor/pxt/kiosk/public/`, that is a bug — investigate.

---

## Architecture invariants

These are non-negotiable. Violating any of them is a critical issue in code review.

1. **Submodule isolation.** All customizations live in `overrides/`. `scripts/apply-overrides.sh` is the only mechanism that writes into `vendor/pxt/`. The script is idempotent.

2. **No telemetry leaves the device.** `pxt-stub.js` replaces the upstream `pxt` global. `pxt.tickEvent`, `pxt.reportError`, `pxt.reportException` are local no-ops (debug-loggable, never network-bound). `pxt.Cloud.apiRoot` is hard-coded to `about:blank` so accidental backend calls fail loudly rather than silently exfiltrate data. Any new `pxt.*` surface the upstream Kiosk starts using MUST be stubbed locally with the same "no network" discipline.

3. **Gamepad bridge is inert in real browsers.** `native-gamepad-bridge.js` only installs the polyfill when `window.webkit.messageHandlers.gameController` exists (the tvOS WebView contract). In a regular browser, it returns early and the real Gamepad API works normally. The bridge must never produce a behavioral diff for non-shell users.

4. **Load order is part of the contract.** `index.html` injection happens via `apply-overrides.sh` with this exact order before `</head>`:
   1. `pxt-stub.js` — defines `window.pxt` before any code references it
   2. `native-gamepad-bridge.js` — installs the `getGamepads` override before Kiosk's `GamepadManager.initialize()` calls it on mount
   3. CRA bundle (Kiosk app)
   Changing this order will break startup. Don't.

5. **Assets must work at any URL root.** `apply-overrides.sh` sets `package.json` `homepage` to `"."` so CRA emits relative asset paths. This is what lets the same build serve from GitHub Pages, a custom domain, and a `file://` URL in the tvOS shell. Don't reintroduce absolute paths.

---

## Repo layout

```
mkc-arcade-kiosk/
├── .github/workflows/deploy.yml   # GitHub Pages deploy on push to main
├── .github/dependabot.yml         # monthly submodule + actions bumps
├── overrides/                     # ALL customizations live here
│   ├── public/
│   │   ├── native-gamepad-bridge.js
│   │   └── pxt-stub.js
│   ├── games.json                 # the file edited most often
│   └── README.md
├── scripts/
│   ├── apply-overrides.sh         # idempotent build-time injection
│   └── bump-submodule.sh          # manual bump helper (Dependabot is preferred)
├── vendor/pxt/                    # submodule, do not edit
├── tests/                         # Jest tests (independent of kiosk build)
├── .nvmrc                         # node 22
├── package.json                   # convenience scripts only
├── CHANGELOG.md
├── TODO.md
└── mkc-arcade-kiosk-SPEC.md       # source of truth for these rules
```

Anything that doesn't fit one of these locations needs a deliberate decision documented in the design doc — don't invent a new top-level directory casually.

---

## Build flow

Single command from a clean checkout:

```bash
git clone --recurse-submodules <repo>
cd mkc-arcade-kiosk
npm run dev          # local dev server
# or
npm run build        # production build into vendor/pxt/kiosk/build/
```

Internally, both run `scripts/apply-overrides.sh` first, which:
1. Copies `overrides/public/*` into `vendor/pxt/kiosk/public/`
2. Copies `overrides/games.json` into the same location
3. Substitutes `%MKC_DEBUG%` in `pxt-stub.js` with `${MKC_DEBUG:-false}`
4. Sets `vendor/pxt/kiosk/package.json` `homepage` to `"."`
5. Idempotently injects the two `<script>` tags into `index.html` (guarded by an `<!-- mkc-arcade-kiosk injected -->` marker)

If you change a script step, preserve idempotency — a second run must produce no further changes. Verify with `git -C vendor/pxt diff --stat` after a double-run.

---

## Deploy flow

GitHub Pages, automated:
- Trigger: push to `main` (or `workflow_dispatch`)
- Pipeline: `actions/checkout@v4 (submodules: recursive)` → `setup-node@v4 (node 22)` → `apply-overrides.sh` → `npm ci` in `vendor/pxt/kiosk/` → `npm run build` → `upload-pages-artifact` → `deploy-pages@v4`
- Build-time variable: `MKC_DEBUG` (repo-level Actions variable). When `"true"`, `pxt-stub.js` logs telemetry calls and exposes `window.__pxtStubStats`. Default is silent.
- Concurrency: `group: pages, cancel-in-progress: false` — never cancel an in-flight Pages deploy.

The deploy is the only path to production. Don't hand-publish artifacts.

---

## Submodule discipline

- **Pinned by SHA, not by branch.** A floating ref would make builds non-reproducible.
- **Bumps come from Dependabot** (monthly schedule, `prefix: "deps(pxt)"`). The PR shows the diff — review and merge only after CI is green.
- **Manual bump:** `npm run submodule:bump` exists for emergencies. Prefer Dependabot's PR flow because it gives you a diff to review.
- **Cooling-off period:** when picking a SHA manually (initial pin or emergency bump), use a commit at least 7 days old so other consumers find regressions first.
- **Before merging a bump:** run the local build, open the kiosk, click through to a game, exit back to the carousel. Smoke test catches Kiosk-side data-flow changes (e.g., upstream renaming `cfg.kiosk.games`).

---

## games.json schema

`overrides/games.json` is the file you edit most often. Required shape:

```json
{
  "games": [
    {
      "id": "12345-67890-12345-67890",
      "name": "Display name",
      "description": "One-sentence description.",
      "highScoreMode": "SingleAscending"
    }
  ]
}
```

Field rules:
- `id` (string, required) — either `12345-67890-12345-67890` (20-digit share ID) or `_abcdefABCDEF` (persistent project ID, leading underscore + alphanumeric). Tested in `tests/games-json.test.js`.
- `name` (string, required) — short, kid-friendly.
- `description` (string, required) — one sentence, no marketing copy.
- `highScoreMode` (enum, required) — `"SingleAscending"` (higher = better) or `"None"` (no scoring). Other modes exist upstream but are not supported here.

Don't add fields without updating the Jest schema test.

---

## Coding standards

**Versioning:** CalVer `0.YYMM.DDBB` (leading zero, year-month, day + build number). Bump on every released change. The leading zero is intentional — we're not signaling stability.

**Node:** version 22 (pinned in `.nvmrc` and the workflow). Don't add `"engines"` to `package.json` of the override repo — that's a kiosk-internal concern and the kiosk pins its own.

**License:** MIT, copyright "Greg Lamb (greglamb.dev)". Any new file that warrants a header (rare for this repo — most source comes from upstream) gets the canonical MIT short header.

**Scripts:** all repo scripts are `bash` with `set -euo pipefail` and a `ROOT=...` resolution at the top. They must be idempotent — re-running must not produce extra diffs or side effects.

**JavaScript in `overrides/public/`:** browser-only, no build step. Wrap in `(function () { 'use strict'; ... })()` IIFEs. Use ES5-compatible syntax — these files are served raw, not transpiled.

**Commit messages:** Conventional Commits, enforced by hook. `feat`/`fix`/`docs`/`chore`/etc. with optional scope. The submodule bump uses `deps(pxt):`.

---

## Testing standards

Tests live in `tests/` at the repo root, **not** inside `vendor/pxt/`. They run independently of the kiosk build.

Required test files:
- `tests/pxt-stub.test.js` — validates the stub's surface (targetConfigAsync caching, telemetry no-op, debug toggle, Cloud.apiRoot, Util.escapeForRegex)
- `tests/native-gamepad-bridge.test.js` — validates polyfill activation, getGamepads shape, connect/disconnect events, JSON-or-array payload handling
- `tests/games-json.test.js` — schema validation against the real `overrides/games.json`
- `tests/apply-overrides.test.js` — integration test: run the script against a fake kiosk dir, assert idempotency

Framework: Jest with the jsdom environment. Mock `fetch`, `document.baseURI`, and `window.webkit.messageHandlers.gameController` as needed.

**Coverage target: ≥75%.** Below 75% blocks merge in code review. The coverage is for `overrides/` and `scripts/`, not for the submodule.

TDD: every behavioral change starts with a failing test (RED), then a minimal implementation (GREEN), then refactor. See `goodvibes:test-driven-development` for the discipline.

---

## .gitignore conventions

The kiosk-specific entries (added on top of the standard Node template):

```
# Build artifacts inside the submodule (defensive — submodule isolation
# already prevents these from being committed, but be explicit)
vendor/pxt/kiosk/build/
vendor/pxt/kiosk/node_modules/
vendor/pxt/kiosk/public/native-gamepad-bridge.js
vendor/pxt/kiosk/public/pxt-stub.js
vendor/pxt/kiosk/public/games.json
```

Rationale: the override files are *copies* generated by `apply-overrides.sh`. If git ever tries to track the copies, it means we'd be committing into the submodule's working tree — exactly what submodule isolation forbids.

The goodvibes entries (`.worktrees`, `_gitignored`, `_reference`) are also present and should remain.

---

## Canonical scaffold sequence

When scaffolding this project from scratch (or recovering from a destructive mistake), follow this order. Each step has an acceptance check; do not advance until it passes. See SPEC §5 for full detail.

1. **Repo skeleton.** `git init -b main`, create `.gitignore`, `.nvmrc`, `LICENSE`, `package.json`, `README.md`, `SPEC.md`, directory structure. Commit "Initial scaffold". Acceptance: `git status` clean, `package.json` correct.

2. **Add submodule.** `git submodule add https://github.com/microsoft/pxt vendor/pxt`. Pin to a SHA ≥7 days old. Commit `"Pin pxt submodule to <SHA>"`. Acceptance: `git submodule status` shows the pinned SHA.

3. **Add override files.** Create `overrides/public/pxt-stub.js`, `overrides/public/native-gamepad-bridge.js`, `overrides/games.json`, `overrides/README.md`. Acceptance: files match the spec byte-for-byte.

4. **Add build scripts.** Create `scripts/apply-overrides.sh` (including the `%MKC_DEBUG%` sed substitution) and `scripts/bump-submodule.sh`. `chmod +x scripts/*.sh`. Acceptance: running `apply-overrides.sh` against the initialized submodule produces the expected files and is idempotent.

5. **Add CI.** Create `.github/dependabot.yml` and `.github/workflows/deploy.yml`. Acceptance: YAML validates with `actionlint`.

6. **Local build validation.** `./scripts/apply-overrides.sh && cd vendor/pxt/kiosk && npm ci && CI=false npm run build`. Acceptance: clean build, `build/index.html` has both injected scripts, `build/games.json` matches the override.

7. **Push and verify.** `gh repo create greglamb/mkc-arcade-kiosk --public --source=. --remote=origin --push`, set Pages source to GitHub Actions, wait for green deploy, open the URL, smoke test with a controller.

8. **Tag a release.** `git tag -a "v0.YYMM.DDBB" -m "Initial release" && git push origin --tags`.

Skipping a step is allowed only when an earlier step is already complete and verified — never to "save time" on a fresh scaffold.

---

## Final validation checklist

A change to this repo is correctly implemented if and only if (where applicable):

1. `git clone --recurse-submodules ... && npm run dev` opens a working dev server.
2. Pushing to `main` produces a green GitHub Actions deploy.
3. The deployed URL renders the carousel with the configured games.
4. An Xbox/PS5 controller paired to the host drives the carousel.
5. WASD/arrow-key fallback works.
6. Browser console has zero error-level messages.
7. `?mkcDebug=1` produces `[pxt-stub]` log entries.
8. Jest tests pass with ≥75% coverage.
9. Dependabot continues to file submodule and actions PRs monthly.
10. The companion tvOS app loads the URL and the bridge activates (`[native-gamepad-bridge] Installing (native shell detected)`).

If you change something that could plausibly affect any of these, validate the affected ones before declaring done.
