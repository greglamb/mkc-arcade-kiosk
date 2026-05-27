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

### Changed

### Fixed

### Removed

## [v0.2605.2601] - 2026-05-26

Initial release of the self-hosted MakeCode Arcade Kiosk.

### Added

- Carousel with two starter games: Starfox (share ID `S33849-24922-26975-56296`) and Space Destroyer (share ID `50225-04801-24334-14778`).
- Deployment to GitHub Pages at https://greglamb.github.io/mkc-arcade-kiosk/.
- Xbox/PS5 controller support via the browser Gamepad API; WASD/arrow-key keyboard fallback.
- Companion tvOS shell can pair with the carousel via a native gamepad bridge (`window.webkit.messageHandlers.gameController`).
- `?mkcDebug=1` query parameter exposes pxt-stub telemetry counters at `window.__pxtStubStats` for debugging.
- No telemetry leaves the device — `pxt.Cloud.apiRoot` is pinned to `about:blank`.
