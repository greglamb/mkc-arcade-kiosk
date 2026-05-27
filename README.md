# mkc-arcade-kiosk

A self-hosted carousel for [MakeCode Arcade](https://arcade.makecode.com) games. Designed for kids — runs in a browser, pairs with an Xbox / PS5 controller, and never phones home.

**Live:** https://greglamb.github.io/mkc-arcade-kiosk/

## What it is

A thin wrapper around Microsoft's [MakeCode Arcade Kiosk](https://github.com/microsoft/pxt/tree/master/kiosk) UI. The upstream kiosk lives as a pinned git submodule at `vendor/pxt/`; all our customizations live in [`overrides/`](overrides/) and are copied into the submodule at build time. This keeps the submodule pristine so monthly Dependabot bumps merge cleanly.

The kiosk:

- Shows a scrollable carousel of MakeCode Arcade games and launches each in an embedded simulator.
- Tracks high scores in `localStorage`.
- Pairs natively with the Gamepad API (Xbox / PS5 controllers via Bluetooth). Falls back to WASD / arrow keys for keyboard play.
- Replaces upstream's Microsoft analytics with no-op stubs; `pxt.Cloud.apiRoot` is pinned to `about:blank` so no backend calls leak.
- Deploys to GitHub Pages on every push to `main` via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Updating the game list

This is the most common edit. Open [`overrides/games.json`](overrides/games.json) and add or remove entries. Three MakeCode share-ID formats are accepted:

| Format | Example |
|---|---|
| 20-digit numeric | `50225-04801-24334-14778` |
| S-prefix | `S33849-24922-26975-56296` |
| Persistent (underscore-prefix) | `_aBcDeF` |

To get a share ID:

1. Open the game on [arcade.makecode.com](https://arcade.makecode.com).
2. Click **Share** → **Share Project**.
3. Copy the ID from the URL (everything after `arcade.makecode.com/`).

Add it to `games.json`:

```json
{
  "id": "S33849-24922-26975-56296",
  "name": "Starfox",
  "description": "Pilot the Arwing through space and shoot enemy fighters",
  "highScoreMode": "SingleAscending"
}
```

- `name` and `description` are shown in the carousel — keep them short.
- `highScoreMode` is `"SingleAscending"` (higher = better) or `"None"` (no scoring).

Then commit and push:

```bash
git add overrides/games.json
git commit -m "feat(games): add <Game Name>"
git push
```

The push kicks off the deploy workflow. Allow ~2 minutes from push to live URL. Browser cache can be stubborn — hard-refresh (⌘⇧R / Ctrl+Shift+R) if the new game doesn't appear.

### GitHub-hosted games

GitHub repo paths like `gigglyparrot/starfox` are **not** directly playable from `games.json` — the kiosk's runtime URL builder only resolves share IDs. To play a GitHub-hosted MakeCode game, import it into MakeCode Arcade, share it to get a share ID, then use that ID. Full steps in [`overrides/README.md`](overrides/README.md#what-about-github-repos).

## Operating the kiosk

- **Carousel:** D-pad left/right (or arrow keys / A+D) to scroll. **A** (or Space) launches the selected game.
- **In a game:** **Back** or **Start** returns to the carousel.
- **Debug mode:** Append `?mkcDebug=1` to the URL to log telemetry counters to the console and expose them at `window.__pxtStubStats`.

The native gamepad bridge ([`overrides/public/native-gamepad-bridge.js`](overrides/public/native-gamepad-bridge.js)) activates only when running inside the companion tvOS WebView (which exposes `window.webkit.messageHandlers.gameController`). In a regular desktop browser, it does nothing and the standard Gamepad API works.

## Local development

Requires Node 22 (pinned in `.nvmrc`).

```bash
git clone --recurse-submodules https://github.com/greglamb/mkc-arcade-kiosk
cd mkc-arcade-kiosk
nvm use
npm install
npm test          # Jest suite (8 files, ~85 tests)
```

To produce a build that matches CI:

```bash
./scripts/apply-overrides.sh
cd vendor/pxt && npm install --no-save --no-audit --no-fund --no-package-lock --ignore-scripts react@^18 react-dom@^18 @types/react @types/react-dom
cd kiosk && npm ci
CI=false npm run build
# Open vendor/pxt/kiosk/build/index.html (or serve via `npx http-server build/`)
```

## Architecture

```
mkc-arcade-kiosk/
├── overrides/                  # ALL customizations live here
│   ├── public/
│   │   ├── native-gamepad-bridge.js
│   │   └── pxt-stub.js         # mocks the upstream `pxt` global
│   ├── src/
│   │   ├── index.tsx           # no-telemetry React bootstrap
│   │   └── pxt.d.ts            # ambient TypeScript declarations
│   ├── tsconfig.paths.json     # pins React to a single instance
│   ├── games.json              # ← THE file you edit most
│   └── README.md
├── scripts/
│   ├── apply-overrides.sh
│   ├── inject-html.js
│   └── bump-submodule.sh
├── vendor/pxt/                 # pinned submodule, NEVER edit directly
├── tests/                      # Jest tests
└── .github/
    ├── workflows/deploy.yml
    └── dependabot.yml
```

**The one rule that matters most:** never edit anything inside `vendor/pxt/`. All changes go in `overrides/` and are applied by `scripts/apply-overrides.sh` at build time. If you catch yourself opening a file under `vendor/pxt/`, stop and find (or add) the matching `overrides/` path.

## Cutting a release

Versioning is CalVer: `0.YYMM.DDBB` where `BB` is a per-day build counter starting at `01`.

1. Bump `"version"` in [`package.json`](package.json) to today's date + counter.
2. Promote `[Unreleased]` to a dated section in [`CHANGELOG.md`](CHANGELOG.md) following [Keep a Changelog](https://keepachangelog.com).
3. Commit ONLY those file changes:
   ```bash
   git commit -m "chore(release): v0.YYMM.DDBB"
   ```
4. Tag and push:
   ```bash
   git tag -a "v0.YYMM.DDBB" -m "Brief release note"
   git push origin main "v0.YYMM.DDBB"
   ```

## Companion repo

The deployed URL is also designed to load inside a native tvOS WebView via a separate companion app at [`greglamb/mkc-arcade-kiosk-tvos`](https://github.com/greglamb/mkc-arcade-kiosk-tvos) (out of scope for this repo).

## Further reading

- [`mkc-arcade-kiosk-SPEC.md`](mkc-arcade-kiosk-SPEC.md) — full architectural spec
- [`overrides/README.md`](overrides/README.md) — override-system mechanics + game-adding workflow
- [`docs/goodvibes/specs/`](docs/goodvibes/specs/) — per-feature design docs
- [`CHANGELOG.md`](CHANGELOG.md) — user-facing changes per release
- [`TODO.md`](TODO.md) — open work and tech debt

## License

MIT — see [`LICENSE`](LICENSE).
