# TODO

## Next Up

<!-- Actively queued work. Items here should be ready to start. -->

## Blocked

<!-- Waiting on external dependency, decision, or other block. Each entry should name what's blocking it. -->

## Someday/Maybe

<!-- Ideas worth considering, no commitment. Lowest priority. -->

## Known Limitations

<!-- Intentional scope reductions documented for users. These are features we've chosen not to build. -->

## Tech Debt

<!-- Internal debt to address eventually. Things that work but aren't right. -->

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
