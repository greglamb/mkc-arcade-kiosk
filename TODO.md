# TODO

## Next Up

<!-- Actively queued work. Items here should be ready to start. -->

- [2026-05-26] Implementation: kiosk source overrides (v1 plan extension)
  Detail: Design landed at `docs/goodvibes/specs/2026-05-26-kiosk-source-overrides-design.md` (commit `75c3ecb`). Next: invoke `goodvibes:writing-plans` to produce a 5–7 task TDD plan covering (a) `overrides/src/index.tsx` (no-telemetry bootstrap), (b) `overrides/src/pxt.d.ts` (ambient declarations), (c) `overrides/tsconfig.paths.json` (drop absent react aliases), (d) `overrides/public/pxt-stub.js` extension (`BrowserUtils.isLocalHost` + `Utils.*`), (e) `scripts/apply-overrides.sh` (Node 22 fail-fast + 3 new copy steps), (f) `.gitignore` (3 new entries). Once green, resume v1 T17 → T18. Folds in Tech Debt #2 and #3 (see below — they'll close when this lands).

## Blocked

<!-- Waiting on external dependency, decision, or other block. Each entry should name what's blocking it. -->

- [2026-05-26] v1 plan T17 (local build validation) and T18 (full Jest suite)
  Blocker: requires the kiosk source overrides implementation (see "Next Up"). Design is approved; the plan + execution still to come. Once T17 builds clean and T18 hits ≥75% coverage, both unblock.

## Someday/Maybe

<!-- Ideas worth considering, no commitment. Lowest priority. -->

## Known Limitations

<!-- Intentional scope reductions documented for users. These are features we've chosen not to build. -->

## Tech Debt

<!-- Internal debt to address eventually. Things that work but aren't right. -->

- [2026-05-26] SPEC §4.10's "minimal pxt-stub" premise is incorrect at the pinned SHA
  Detail: SPEC §7 mentioned "Upstream adds new pxt.* calls the stub doesn't cover" as a risk with mitigation "Extend stub; failure mode is loud, not silent." Reality at SHA `1aa8c6c`: kiosk source references >15 pxt.* members not in the v1 stub. **Being addressed** by the kiosk-source-overrides design (commit `75c3ecb`) — replaces `kiosk/src/index.tsx`, adds an ambient `kiosk/src/pxt.d.ts`, and extends `pxt-stub.js` with `BrowserUtils.isLocalHost` + `Utils.*`. Closes when "Next Up" implementation lands.

- [2026-05-26] SPEC's `npm ci` flow doesn't cover the kiosk's tsconfig.paths.json aliases
  Detail: `tsconfig.paths.json` aliases `react/*` → `../node_modules/react/*` (pxt root, not kiosk). Webpack needs `vendor/pxt/node_modules/react` populated, but the SPEC's deploy.yml only installs kiosk-level deps. **Being addressed** by the kiosk-source-overrides design via `overrides/tsconfig.paths.json` which drops the `react/*` and `react-dom/*` aliases entirely. Closes when "Next Up" implementation lands.

- [2026-05-26] `npm install` at vendor/pxt root fails on leveldown native compile under Node 24
  Detail: leveldown@5.6.0 (transitive dep) fails node-gyp rebuild on Node v24.12.0 (Darwin). Root cause: nvm isn't auto-invoked in the dev shell so the wrong Node major runs. **Being addressed** by the kiosk-source-overrides design via a fail-fast Node-major check at the top of `apply-overrides.sh` (reads `.nvmrc`, exits 1 with a clear message if mismatched). Closes when "Next Up" implementation lands.

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

- [2026-05-26] Full upstream `gulp build` of pxt-core to generate `built/pxt.d.ts` (T17 architectural pivot)
  Rationale: heavy CI cost, native-compile failures already burned us under Node 24, AND would ship with Microsoft analytics enabled and `Cloud.apiRoot` pointing at makecode.com — directly violates the no-telemetry invariant. Authoring our own minimal ambient `pxt.d.ts` shim is the right tradeoff.

- [2026-05-26] Pin an older pxt SHA where kiosk was simpler (T17 architectural pivot escape)
  Rationale: trades fresh upstream for an unknown coupling state. The cooling-off rule (≥7 days old) already protects against bleeding-edge regressions; bypassing the kiosk-source-override design just defers the same coupling problem to the next Dependabot bump.

- [2026-05-26] Stop and fully rewrite SPEC.md before continuing (T17 architectural pivot escape)
  Rationale: slowest path; the SPEC is mostly correct, just under-specified about compile-time coupling. Surgical kiosk-source-overrides design + later round-trip PR is faster and more honest.

- [2026-05-26] Triple-slash reference to a shimmed `vendor/pxt/built/pxt.d.ts` (kiosk-source-overrides design alt)
  Rationale: same content as the chosen approach but the shim lives outside `tsconfig.json`'s `include: ["src"]`, requiring explicit triple-slash refs in our `index.tsx`. Adds indirection for no benefit — we still author every declaration.

- [2026-05-26] Install React family at `vendor/pxt/` root via `npm install --no-save --ignore-scripts` (the current T17 workaround)
  Rationale: writes into the submodule's `node_modules`, creates a long-running implicit dependency, and `--ignore-scripts` masks build failures we'd prefer to see. The `overrides/tsconfig.paths.json` approach is cleaner — dropping the aliases lets standard webpack resolution find React in `kiosk/node_modules`.

- [2026-05-26] Author `mkc-arcade-kiosk-ADDENDUM-02.md` immediately as sibling to SPEC
  Rationale: premature — the design may evolve during T17 implementation. The design doc at `docs/goodvibes/specs/2026-05-26-kiosk-source-overrides-design.md` is the working source of truth. Promote to an addendum after T17 + T18 ship green.

- [2026-05-26] Put `pxt.BrowserUtils` and `pxt.Utils` runtime values in `kiosk/src/index.tsx` instead of `pxt-stub.js`
  Rationale: mixes concerns. The stub is the always-on baseline (provides the network-silent contract); `index.tsx` is the React-tree entry point. Stub gets the runtime values; `index.tsx` gets the React mount.

- [2026-05-26] Add `"engines": { "node": "22.x" }` to root `package.json` instead of a script-level gate
  Rationale: npm warnings get ignored; project-standards explicitly forbids `"engines"` in root `package.json` (kiosk-internal concern). A hard fail-fast in `apply-overrides.sh` is what actually catches the footgun.

- [2026-05-26] Reskin the kiosk's bootstrap with our own React entry tree (kiosk-source-overrides design alt)
  Rationale: out of v1 scope. Would mean owning the entire React tree, not patching upstream — invalidates the submodule + overrides architecture.

<!--
Entry format:
- [YYYY-MM-DD] Short description
  Detail: what it is, why it matters, blocker (if applicable), rationale (if rejected)
-->
