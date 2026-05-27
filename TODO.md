# TODO

## Next Up

<!-- Actively queued work. Items here should be ready to start. -->

- [2026-05-26] Hand-off remaining: hardware smoke test + (optional) GitHub Release page
  Detail: v1 shipped — tag `v0.2605.2601` pushed at commit `9db62a6`, six consecutive deploys green, live at https://greglamb.github.io/mkc-arcade-kiosk/ with Starfox (share `S33849-24922-26975-56296`) + Space Destroyer (share `50225-04801-24334-14778`) both confirmed working (browser console clean of the useReducer + 404 errors that broke deploys 4–5). Remaining: (a) hardware smoke test — pair Xbox/PS5 controller via Bluetooth and verify carousel cycle + A-launches + Back-returns + WASD/arrow-key fallback, (b) verify `?mkcDebug=1` shows `[pxt-stub]` console lines + `window.__pxtStubStats`, (c) (optional) `gh release create v0.2605.2601 --notes-from-tag` to surface the CHANGELOG content on the Releases page, (d) revisit deferred project-standards promotions in Someday/Maybe.

- [2026-05-26] T17 iteration discovered 3 more pxt.* symbols — see commit `13068fd`
  Detail: Build clean required adding `lf` global, `pxt.BrowserUtils.isMobile`, and `pxt.Cloud.JsonScript` type — plus loosening index signatures on `TargetBundle`/`WebConfig`/`TargetConfig` from `unknown` to `any` (kiosk reads arbitrary properties off bundles). Documented for future Dependabot bump review. This is exactly the "1–3 symbols may surface" prediction from the design's risk table — design held.

## Blocked

<!-- Waiting on external dependency, decision, or other block. Each entry should name what's blocking it. -->

<!-- T17/T18 are no longer blocked — extension shipped 2026-05-26. See Next Up. -->

## Someday/Maybe

<!-- Ideas worth considering, no commitment. Lowest priority. -->

- [2026-05-26] Node.js 20 actions deprecation (GitHub annotation, 2026-06 forced switch)
  Detail: `actions/checkout@v4`, `actions/configure-pages@v5`, `actions/setup-node@v4`, `actions/upload-artifact@v4` all run on Node 20 today. GitHub force-switches to Node 24 on 2026-06-02 and removes Node 20 on 2026-09-16. Dependabot is configured for monthly github-actions bumps, so newer pinned versions should arrive automatically and resolve this before the deadline. Watch for Dependabot PRs labeled `dependencies` + `ci` and merge when CI is green.

- [2026-05-26] Promote three project-standards findings (deferred until v1 T17/T18 ship green)
  Detail: From the kiosk-source-overrides brainstorm (design doc `docs/goodvibes/specs/2026-05-26-kiosk-source-overrides-design.md` §14). Three candidates: (1) post-Dependabot-bump check that greps `kiosk/src/` for new `pxt.*` symbols and verifies they're in `overrides/src/pxt.d.ts` + `overrides/public/pxt-stub.js`, (2) note that the `pxt` global is a load-bearing TS ambient (not just a runtime stub), (3) Node 22 fail-fast as a confirmed property of `apply-overrides.sh` (not aspirational). Trigger: revisit after the kiosk-source-overrides implementation lands and T17/T18 are green. Decision (user, 2026-05-26): defer to avoid churning project-standards before the design has been exercised end-to-end.

## Known Limitations

<!-- Intentional scope reductions documented for users. These are features we've chosen not to build. -->

## Tech Debt

<!-- Internal debt to address eventually. Things that work but aren't right. -->

<!-- All three 2026-05-26 Tech Debt items CLOSED by kiosk-source-overrides extension (commits 8445470..14c6886 + 13068fd). -->
<!-- Tech Debt #1 (pxt-stub premise): closed by overrides/src/pxt.d.ts + overrides/src/index.tsx + pxt-stub extension. -->
<!-- Tech Debt #2 (tsconfig.paths.json): closed by overrides/tsconfig.paths.json dropping react/* aliases. -->
<!-- Tech Debt #3 (Node 24 leveldown): closed by Node-major fail-fast in scripts/apply-overrides.sh. -->

- [2026-05-26] ADDENDUM-01 GitHub-repo-path runtime support (rolled back; needs runtime URL translator)
  Detail: ADDENDUM-01 (commit `9f468eb`) promised three id formats in `games.json` including GitHub repo paths like `gigglyparrot/starfox`. Schema validation shipped fine, but the kiosk's `PlayingGame.tsx` passes the id straight through to `arcade.makecode.com/api/<id>/text` which only resolves share IDs — github-format ids hit 404 at game launch. **Rolled back same day** (commits TBD): `games.json` now accepts only share-id formats (20-digit, S-prefix, persistent). Implementing it correctly requires either (a) a runtime translator that builds a `/--run?github=org/repo` URL (need to verify MakeCode supports this), or (b) pre-building games during CI and serving the JS ourselves. ADDENDUM-01 marked superseded.

- [2026-05-26] CI build relies on react family staged at `vendor/pxt/` root (see `bec82d6`)
  Detail: First deploy after pushing to greglamb/mkc-arcade-kiosk failed because webpack couldn't resolve `react-dom` — kiosk's `package.json` declares `@types/react` and `@types/react-dom` as `file:../node_modules/...` (file-based deps pointing at `vendor/pxt/node_modules`), and react/react-dom themselves aren't direct deps at all. Fix: added a "Stage react family at vendor/pxt root" step to deploy.yml using `npm install --ignore-scripts --no-save --no-package-lock` (the `--ignore-scripts` dodges leveldown's native-compile failure). Cleaner long-term fix: patch `kiosk/package.json` via apply-overrides to declare `react` and `react-dom` as direct deps and replace the `file://` paths with version specifiers — but that breaks `npm ci` (lockfile drift) and requires switching to `npm install`. Defer until upstream changes the kiosk's dep shape or Dependabot bumps reveal a cleaner path.

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
  Rationale (rejected at design time): writes into the submodule's `node_modules`, creates a long-running implicit dependency, and `--ignore-scripts` masks build failures we'd prefer to see. The `overrides/tsconfig.paths.json` approach is cleaner — dropping the aliases lets standard webpack resolution find React in `kiosk/node_modules`.
  **Update (later same day, commit `bec82d6`): ADOPTED.** Rejection was wrong. The tsconfig.paths drop is necessary but not sufficient — kiosk's `file:../node_modules/@types/react` deps require `vendor/pxt/node_modules` to exist at all, AND react/react-dom themselves aren't kiosk-declared deps so they don't land in `kiosk/node_modules` either. The first CI deploy failed with `Module not found: Can't resolve 'react-dom'`. Re-instated as a CI workflow step (with `--ignore-scripts` accepted as the trade-off for dodging leveldown). Logged as Tech Debt for a cleaner long-term fix.

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
