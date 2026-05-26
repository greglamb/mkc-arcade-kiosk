# Design: mkc-arcade-kiosk v1 scaffold

**Date:** 2026-05-26
**Status:** Approved (pending user review of this doc)
**Source of truth:** `mkc-arcade-kiosk-SPEC.md` is authoritative for *what* we are building (architecture, file contents, contracts, acceptance criteria). This design doc captures *how* and *in what order* we will implement v1, the deltas relative to SPEC §5, the bugs found during the verification pass, the rejected alternatives, and the hand-off boundary.

**Addenda incorporated:** `mkc-arcade-kiosk-ADDENDUM-01.md` — GitHub repo references in `games.json` (third permitted `id` format + fallback share-id guard test). Supersedes SPEC §4.12 (games.json contents), §4.13 (overrides/README.md "Adding a game" section), and §6.3 (games-json.test.js). Adds an item to SPEC §9 final validation and a risks-table extension to §7.

## 1. Scope (v1)

Implement SPEC §5 steps 1–6 plus the §6 test plan. Goal: a working `npm run build` locally with a green Jest suite, ready to push.

In:
- File scaffold (overrides, scripts, workflows, root `package.json` with devDeps, `.nvmrc`, reconciled `.gitignore`).
- `vendor/pxt` git submodule pinned to a SHA you select.
- `apply-overrides.sh` (with the §4.10 `%MKC_DEBUG%` substitution merged and a portable `index.html` injection).
- `bump-submodule.sh`.
- `.github/workflows/deploy.yml` (with the `MKC_DEBUG` env hoisted to job level — bug fix).
- `.github/dependabot.yml`.
- Jest tests under `tests/` for `pxt-stub.js`, `native-gamepad-bridge.js`, `games.json`, and `apply-overrides.sh`. Coverage target ≥75%.
- Successful local `npm run build`.

Out (hand-off — see §10):
- `gh repo create greglamb/mkc-arcade-kiosk --public ...` and the initial push.
- Enabling GitHub Pages → Actions in the repo UI.
- Physical Xbox/PS5 controller smoke test on the deployed URL.
- First version tag.

## 2. Non-goals (verbatim from SPEC §1 and §8)

- App Store distribution and the tvOS shell (separate repo: `greglamb/mkc-arcade-kiosk-tvos`).
- Multi-tenant kiosks.
- Editing/authoring games (still done on `arcade.makecode.com`).
- Custom theming.
- Per-kid profiles.
- Offline support / cached game PNGs.
- Telemetry to any backend (the kiosk is intentionally network-silent past the GitHub Pages origin and the iframe’d arcade.makecode.com).
- Analytics.
- A11y improvements beyond upstream Kiosk.

## 3. Approach (chosen)

**Single TDD-driven implementation plan, SPEC §5 order with tests interleaved per override file.**

For each override file: write the failing Jest test, watch it fail, write the override, watch it pass, commit. This honors `project-standards`’ TDD rule and surfaces stub-coverage gaps (one of the SPEC §7 risks) before the gaps reach a build.

The plan emerges as ~18 tasks of 2–5 minutes each. Each task ends with a verification command and a commit, per `goodvibes:writing-plans`. The plan terminates at successful local `npm run build` + `npm test` green. Steps 7–8 of SPEC §5 are documented as a hand-off checklist for you to run when convenient.

## 4. Rejected approaches

To be logged in `TODO.md` under `## Rejected Approaches` per the project's "no silent rejections" rule.

1. **Big-bang scaffold then test.** Create every file in SPEC §5 order, write all tests last. *Rejected:* violates `project-standards` TDD discipline. A plausibly-correct stub can pass an eyeball check but fail real Kiosk runtime use, and the cost of discovery is much higher post-integration.
2. **Split into multiple plans (scaffold → overrides → CI → tests).** *Rejected:* the SPEC's eight steps are linearly dependent. Splitting introduces artificial hand-offs without reducing cognitive load. A single plan with explicit checkpoints between tasks is more honest about the scope and easier to resume.
3. **Fork `microsoft/pxt` instead of using a submodule.** *Rejected:* heavier maintenance, loses Dependabot's auto-bump benefit, ratcheting on upstream improvements becomes manual merge work. SPEC's submodule + overrides model is the right tradeoff.
4. **Run `apply-overrides.sh` via `npm postinstall`.** *Rejected:* hidden side effects on `npm install`. The script edits the submodule's working tree; surprising it on a developer who just ran `npm i` is worse than the small ergonomic gain. Keep it explicit in `prebuild`/`predev`.
5. **Eject CRA for control.** *Rejected:* upstream Kiosk is on CRA. Ejecting would break submodule bumps and provide no value for our use case.

## 5. Sequencing (mapped to SPEC §5)

The implementation plan will follow SPEC §5 in order, with the following adjustments to account for current repo state and the bugs found during verification.

### Phase A — Reconcile scaffold (SPEC §5 step 1 — partial)

Already done by `/goodvibes:setup`: `git init`, `LICENSE`, `README.md` stub, `.gitignore` (full Node template + goodvibes entries), `CLAUDE.md`, `TODO.md`, `CHANGELOG.md`, `CHANGELOG_DIRECTIVES.md`, `.pre-commit-config.yaml`, `.gitleaks.toml`, `.claude/skills/project-standards/`, `mkc-arcade-kiosk-SPEC.md`, `.worktrees/`, `_gitignored/`.

Still needed:
- `.nvmrc` containing `22`.
- Root `package.json` (SPEC §4.4 contents) **plus** `devDependencies`: `jest`, `jest-environment-jsdom`, `ajv` (for games.json schema validation). Initial `version` field set to today's CalVer (`0.2605.2601`).
- Merge SPEC §4.1's submodule-build-artifact entries into the existing `.gitignore` (additive, under a clearly-named section).
- Create `mkdir -p overrides/public scripts vendor tests .github/workflows`.

### Phase B — Submodule (SPEC §5 step 2)

- `git submodule add https://github.com/microsoft/pxt vendor/pxt`.
- Present 3 candidate SHAs from `microsoft/pxt`'s `master` log (commits ≥7 days old) for you to pick.
- `cd vendor/pxt && git checkout <SHA>`; commit `"chore(submodule): pin pxt to <SHA>"` (Conventional-Commits-compliant per hook).

### Phase C — Override files with tests (SPEC §5 step 3 + §6)

Per file, RED-GREEN-REFACTOR:

1. `tests/pxt-stub.test.js` (RED), then `overrides/public/pxt-stub.js` (GREEN per SPEC §4.10). Commit.
2. `tests/native-gamepad-bridge.test.js` (RED), then `overrides/public/native-gamepad-bridge.js` (GREEN per SPEC §4.11). Commit.
3. `tests/games-json.test.js` (RED — covers all three `id` formats per ADDENDUM-01 §5 + the fallback-share-id guard), then `overrides/games.json` (GREEN per ADDENDUM-01 §2, superseding SPEC §4.12) + `overrides/README.md` (per ADDENDUM-01 §3, superseding SPEC §4.13). Commit.

### Phase D — Build scripts (SPEC §5 step 4) — with bug fixes

- `scripts/apply-overrides.sh` written **with the §4.10 `%MKC_DEBUG%` sed substitution merged in** (not as a separate callout) and with the `index.html` script injection done via a small Node snippet rather than multi-line BSD-fragile `sed`. The Node snippet idempotently inserts the marker + two `<script>` tags before `</head>` and is a no-op if the marker is already present.
- `scripts/bump-submodule.sh` per SPEC §4.9.
- `chmod +x scripts/*.sh`.
- `tests/apply-overrides.test.js` (Node-based, not bats): creates a fake kiosk dir, runs the script, asserts files present + idempotency. Commit.

### Phase E — CI workflows (SPEC §5 step 5) — with bug fix

- `.github/workflows/deploy.yml` per SPEC §4.7 **with `MKC_DEBUG: ${{ vars.MKC_DEBUG || 'false' }}` hoisted from the *Build kiosk* step's `env:` to the job level** so `apply-overrides.sh`'s substitution sees it.
- `.github/dependabot.yml` per SPEC §4.6.
- Validate locally with `actionlint` if available; otherwise inspect manually. Commit.

### Phase F — Local validation (SPEC §5 step 6)

- `npm run submodule:init && ./scripts/apply-overrides.sh`.
- `cd vendor/pxt/kiosk && npm ci && CI=false npm run build`.
- Assert: `build/index.html` contains both injected `<script>` tags; `build/games.json` matches `overrides/games.json`; `build/pxt-stub.js` does NOT contain the literal `%MKC_DEBUG%`.
- Run `npm test` from repo root; assert green + ≥75% coverage.

End of plan. SPEC §5 steps 7–8 become the hand-off checklist in §10.

## 6. Pre-implementation fixes (spec bugs)

Three issues found during verification that must be corrected as the implementation creates the affected files. Recorded here so they don't recur in a future re-scaffold:

1. **`MKC_DEBUG` env hoist** — workflow exports it at the job level (or at minimum at the *Apply overrides* step), not only at the *Build kiosk* step. Without this, the CI build silently ships with `DEBUG=false` regardless of repo configuration.
2. **`%MKC_DEBUG%` sed substitution merged into `apply-overrides.sh`** — not left as a §4.10-style "implementer must merge" callout. The literal `'%MKC_DEBUG%' === 'true'` is always false; without the substitution, the debug toggle is dead code.
3. **`index.html` injection via Node, not multi-line `sed`** — BSD sed (macOS dev) handles multi-line replacements differently from GNU sed (CI). Switching to Node (which is already a dependency for the `homepage` patch) is portable and avoids a class of macOS-only failures.

After implementation, propose a PR to the SPEC reflecting fixes 1 and 2 (fix 3 is a stylistic choice and stays in the design doc).

## 7. Decisions captured during brainstorm

- **Scope = local-only.** Plan ends at successful local build + green tests. Push, Pages enable, first deploy, controller smoke test, and tagging are hand-off (§10).
- **Submodule SHA selected by user.** I will surface candidate SHAs from `microsoft/pxt`'s `master` log; you pick.
- **TDD on override files.** Test-first per file, RED-GREEN, commit at GREEN. No mass-write of overrides before tests exist.
- **Single plan, ~18 tasks.** Not split. Checkpoint between tasks for review.
- **Initial CalVer:** `0.2605.2601` (year-month + day + build 01) at scaffold time. Bumps on subsequent change.

## 8. Risks (acknowledged, mitigated where possible)

| Risk | Mitigation |
|---|---|
| Upstream Kiosk references a `pxt.*` symbol the stub doesn't provide. | Tests fail loudly during Phase F; production failure mode is a console error, not silent. SPEC §7 lists this. |
| Upstream changes the `cfg.kiosk.games` shape. | Caught by Phase F smoke (assert games appear). Add an explicit shape assertion in `tests/pxt-stub.test.js`. |
| GH Pages outage or rate-limit on first deploy. | Out of v1 plan scope. Hand-off step. |
| Submodule SHA you pick is broken on master. | The ≥7-day cool-off rule from SPEC §4.5 reduces this. If the build fails, pick an older SHA and retry. |
| Jest test for `apply-overrides.sh` doesn't catch every shell quoting bug. | Phase F runs the real script against the real submodule — integration check catches what unit tests miss. |
| `npm ci` on `vendor/pxt/kiosk/` is slow (first-time install can be minutes). | Acceptable cost; one-time. |
| Goodvibes setup files (CLAUDE.md, etc.) aren't in the SPEC. | They ship anyway. CLAUDE.md is fine to publish; not a leak. |

## 9. Done-when

The plan is complete when all of these hold:

1. `npm run dev` opens a working local dev server at `http://localhost:3000/`.
2. `npm run build` produces `vendor/pxt/kiosk/build/index.html` containing both injected `<script>` tags.
3. `vendor/pxt/kiosk/build/pxt-stub.js` does NOT contain the literal `%MKC_DEBUG%`.
4. `vendor/pxt/kiosk/build/games.json` matches `overrides/games.json` byte-for-byte.
5. `npm test` from repo root passes with coverage ≥75% on `overrides/` and `scripts/`.
6. Running `apply-overrides.sh` a second time produces no further changes (verify with `git -C vendor/pxt diff --stat`; snapshots before/after a second run are identical).
7. No file under `vendor/pxt/` is staged for commit at any point (`git status` shows submodule pointer only).
8. The remaining manual hand-off (§10) is documented in a `RELEASING.md` or appended to `README.md`.

## 10. Hand-off checklist (out of plan scope)

After plan completion, you do these:

1. `gh repo create greglamb/mkc-arcade-kiosk --public --source=. --remote=origin --push` — creates the remote and pushes `main`.
2. GitHub web UI → Settings → Pages → Source: **GitHub Actions**.
3. (Optional) Settings → Variables → Actions → add `MKC_DEBUG` if you want debug logging in production.
4. Wait ~3 minutes for the `Deploy to GitHub Pages` workflow run to go green.
5. Open `https://greglamb.github.io/mkc-arcade-kiosk/` in Chrome. Verify the six starter games in the carousel.
6. Pair an Xbox/PS5 controller via Bluetooth; verify d-pad cycles and A launches a game.
7. Verify keyboard fallback (WASD + Space).
8. Append `?mkcDebug=1` to the URL; verify `[pxt-stub]` log lines in the console.
9. `git tag -a "v0.2605.2601" -m "Initial release" && git push origin --tags` — first tagged release. Use today's CalVer at the time of tagging.
10. (Optional) Open a PR to `mkc-arcade-kiosk-SPEC.md` documenting the two spec bugs corrected during implementation (§6.1 and §6.2).

Companion repo `mkc-arcade-kiosk-tvos` is separate and out of scope.
