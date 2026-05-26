# TODO

## Next Up

<!-- Actively queued work. Items here should be ready to start. -->

- [2026-05-26] Design extension: kiosk source override scope (ADDENDUM-02 candidate)
  Detail: The v1 plan blocked at T17 because SPEC §4.10's "minimal pxt-stub" architecture is insufficient at the pinned SHA (`1aa8c6c`). The kiosk's `src/index.tsx` startup path uses 20+ `pxt.*` members and overwrites `pxt.Cloud.apiRoot` to Microsoft's backend (`https://www.makecode.com/api/`), defeating the "no telemetry leaves the device" invariant. Decision (user, 2026-05-26): patch kiosk source via overrides rather than full upstream gulp build or stub expansion. Need a brainstorm pass to define the patched files, the minimal startup, and how to preserve submodule isolation. Resume executing plan T17–T18 only after this design lands.

## Blocked

<!-- Waiting on external dependency, decision, or other block. Each entry should name what's blocking it. -->

- [2026-05-26] v1 plan T17 (local build validation) and T18 (full Jest suite)
  Blocker: requires the kiosk source override design (see "Next Up"). Without the override, `npm run build` fails with `TS2304: Cannot find name 'pxt'` and, even if compile is unblocked, runtime would call Microsoft's backend.

## Someday/Maybe

<!-- Ideas worth considering, no commitment. Lowest priority. -->

## Known Limitations

<!-- Intentional scope reductions documented for users. These are features we've chosen not to build. -->

## Tech Debt

<!-- Internal debt to address eventually. Things that work but aren't right. -->

- [2026-05-26] SPEC §4.10's "minimal pxt-stub" premise is incorrect at the pinned SHA
  Detail: SPEC §7 mentioned "Upstream adds new pxt.* calls the stub doesn't cover" as a risk with mitigation "Extend stub; failure mode is loud, not silent." Reality at SHA `1aa8c6c`: kiosk/src/index.tsx alone uses pxt.analytics, pxt.appTarget, pxt.BrowserUtils, pxt.Cloud.JsonScript, pxt.LogLevel, pxt.Map, pxt.options, pxt.setAppTarget, pxt.setLogLevel, pxt.setupWebConfig, pxt.TargetBundle, pxt.TargetConfig, pxt.Util.userLanguage, pxt.Utils, pxt.webConfig, pxt.worker.getWorker — none of which are in our stub. The fix path (patch kiosk source via overrides) lives under "Next Up".

- [2026-05-26] SPEC's `npm ci` flow doesn't cover the kiosk's tsconfig.paths.json aliases
  Detail: `tsconfig.paths.json` aliases `react/*` → `../node_modules/react/*` (pxt root, not kiosk). Webpack needs `vendor/pxt/node_modules/react` populated. The SPEC's deploy.yml only installs kiosk-level deps. Discovered during T17. Future fix: either install pxt root react family during apply-overrides OR rewrite tsconfig.paths.json via override. To be folded into the same design extension as the kiosk source override.

- [2026-05-26] `npm install` at vendor/pxt root fails on leveldown native compile under Node 24
  Detail: leveldown@5.6.0 (transitive dep of one of pxt's many deps) fails node-gyp rebuild on Node v24.12.0 (Darwin). Workaround: `--ignore-scripts`. Long-term: upstream's CI uses Node 20.x. Our SPEC uses Node 22 via `.nvmrc` but my shell runs Node 24 because nvm isn't auto-invoked. Document expected Node version more loudly (e.g., add `"engines"` to root package.json or fail-fast in apply-overrides.sh).

## Rejected Approaches

<!-- Alternatives considered and rejected, with rationale. Extends 'no silent deferrals' to rejections. -->

- [2026-05-26] Big-bang scaffold then test for v1 implementation
  Rationale: violates `project-standards` TDD rule. A plausibly-correct stub can pass an eyeball check but fail real Kiosk runtime, and the cost of discovery post-integration is much higher than the cost of test-first per override file.

- [2026-05-26] Split v1 implementation into multiple plans (scaffold / overrides / CI / tests)
  Rationale: SPEC §5's eight steps are linearly dependent. Splitting introduces artificial hand-offs without reducing cognitive load. One plan with ~18 small tasks and explicit checkpoints is more honest about the scope.

- [2026-05-26] Fork microsoft/pxt instead of using a git submodule
  Rationale: heavier maintenance burden, loses Dependabot's auto-bump benefit, ratcheting on upstream improvements becomes manual merge work. SPEC's submodule + overrides model is the right tradeoff for a personal-scale fork.

- [2026-05-26] Run apply-overrides.sh via npm postinstall hook
  Rationale: hidden side effects on `npm install` are surprising. The script edits the submodule's working tree; surfacing that behind a routine command is worse than keeping it as an explicit `prebuild`/`predev` step.

- [2026-05-26] Eject CRA from the upstream kiosk for more control
  Rationale: upstream Kiosk is on CRA. Ejecting would break submodule bumps and provides no value for this project's use case.

<!--
Entry format:
- [YYYY-MM-DD] Short description
  Detail: what it is, why it matters, blocker (if applicable), rationale (if rejected)
-->
