# Changelog

All notable user-facing changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [CalVer](https://calver.org/) versioning (`0.YYMM.DDBB`).

Write entries in user voice (not commit-message voice). Infrastructure-only
changes (build config, internal refactors, tests, tooling) do not produce
entries here — they live in git history. See CHANGELOG_DIRECTIVES.md for
the full rules.

## [Unreleased]

### Added

- Bear Adventure (`S95945-29871-05432-20571`) added to the carousel — made by Arlo and Elliot.

### Changed

- Starfox renamed to **Star Eagle** on the carousel. Description still credits Elliot as the author and drops the Arwing reference.
- High-score tracking turned off for the family kiosk. Both games now have `highScoreMode: "None"`, so the carousel no longer shows the "High Scores" panel or prompts for a name on game over.
- Carousel navigation feels snappier on a game controller. The kiosk's "wait between first press and starting to repeat" dropped from 250 ms to 150 ms, and the held-scroll interval dropped from 167 ms (~6 scrolls/sec) to 80 ms (~12 scrolls/sec). Combined with the earlier 16 ms poll rate the controller now drives the carousel at close to native speed.

### Fixed

- Games configured with `"highScoreMode": "None"` no longer trigger the "enter your initials" high-score prompt after every play. Two upstream issues combined to break this: the kiosk overrode the configured mode at runtime with whatever the running game reported, and the post-game check was case-sensitive while the game reports lowercase. Both sides are now patched.

- Gamepad input now drives the actual game running inside the simulator iframe when the kiosk is loaded in a native shell (e.g. the `mkc-arcade-kiosk-tvos` Apple TV app). The bridge previously polyfilled `navigator.getGamepads()` only on the parent kiosk page, so controller input drove the carousel but went dead the moment a game launched. It now installs in every frame, recursively forwards updates across all nested simulator iframes (the pxt simulator nests two iframes deep), and synthesizes the keyboard events the game runtime actually listens for. The left analog stick now drives the same direction keys as the D-pad too.
- MakeCode game audio plays automatically when a game starts. The MakeCode editor wrapper mutes the simulator by default to comply with browser autoplay policies; the bridge now flips that flag programmatically and hides the wrapper's Safari-specific "click to unmute" overlay so it doesn't sit as a confusing red icon over the game.

### Removed

- Space Destroyer removed from the carousel.
- The "Add your game" button on the carousel — the kiosk is admin-curated via `overrides/games.json` and players don't add their own games at runtime.

## [v0.2605.2601] - 2026-05-26

Initial release of the self-hosted MakeCode Arcade Kiosk.

### Added

- Carousel with two starter games: Starfox (share ID `S33849-24922-26975-56296`) and Space Destroyer (share ID `50225-04801-24334-14778`).
- Deployment to GitHub Pages at https://greglamb.github.io/mkc-arcade-kiosk/.
- Xbox/PS5 controller support via the browser Gamepad API; WASD/arrow-key keyboard fallback.
- Companion tvOS shell can pair with the carousel via a native gamepad bridge (`window.webkit.messageHandlers.gameController`).
- `?mkcDebug=1` query parameter exposes pxt-stub telemetry counters at `window.__pxtStubStats` for debugging.
- No telemetry leaves the device — `pxt.Cloud.apiRoot` is pinned to `about:blank`.
