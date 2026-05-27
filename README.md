# mkc-arcade-kiosk

A self-hosted carousel for [MakeCode Arcade](https://arcade.makecode.com) games. Designed for kids — runs in a browser, pairs with an Xbox / PS5 controller, and never phones home.

**Live:** https://greglamb.github.io/mkc-arcade-kiosk/

Companion native shell: [`greglamb/mkc-arcade-kiosk-tvos`](https://github.com/greglamb/mkc-arcade-kiosk-tvos) — a tvOS app that loads this URL fullscreen on an Apple TV and bridges native Bluetooth / Siri Remote input into the page. See [`HANDOFF-TVOS.md`](HANDOFF-TVOS.md) for the cross-repo protocol.

## What it is

A thin wrapper around Microsoft's [MakeCode Arcade Kiosk](https://github.com/microsoft/pxt/tree/master/kiosk) UI. The upstream kiosk lives as a pinned git submodule at `vendor/pxt/`; all customizations live in [`overrides/`](overrides/) and are copied into the submodule at build time. This keeps the submodule pristine so monthly Dependabot bumps merge cleanly.

The kiosk:

- Shows a scrollable carousel of MakeCode Arcade games and launches each in an embedded simulator.
- Tracks high scores in `localStorage`.
- Pairs natively with the Gamepad API (Xbox / PS5 controllers via Bluetooth, plus WASD / arrow-key keyboard fallback). When loaded inside the tvOS shell, a polyfill recursively bridges the native controller into the carousel **AND** into the simulator iframes — so the same controller drives both the menu and the game.
- Left analog stick drives the same direction keys as the D-pad.
- Auto-unmutes the MakeCode simulator's audio so games actually make sound on first launch (no "click to play" overlay).
- Snappy gamepad response: 16 ms poll rate, 150 ms initial press-to-repeat, 80 ms held-scroll repeat (vs. upstream's 50 / 250 / 167 ms).
- Replaces upstream's Microsoft analytics with no-op stubs; `pxt.Cloud.apiRoot` is pinned to `about:blank` so no backend calls leak.
- Admin-curated: no in-app "Add your game" button. Game list lives in `overrides/games.json`, edited by the maintainer.
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
  "description": "Shoot enemy fighters in space! Made by Elliot.",
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

**Carousel navigation**

- D-pad left/right (or arrow keys / A+D) to scroll, left analog stick also drives the same direction keys.
- **A** (or Space) launches the selected game. **B** (or Enter) is also wired through for in-game use.
- **Back** or **Start** returns to the carousel from inside a game.

**Debug URL parameters**

- `?mkcDebug=1` — log telemetry counters to the console and expose them at `window.__pxtStubStats`.
- `?locked=0` — escape hatch that re-enables the upstream "Add your game" button (normally hidden via [`overrides/src/State/AppStateContext.tsx`](overrides/src/State/AppStateContext.tsx)). Useful for testing the upstream UX without redeploying.

**Console test helpers** ([`overrides/public/native-gamepad-test-helpers.js`](overrides/public/native-gamepad-test-helpers.js))

Always loaded — call from the browser devtools console to drive synthetic gamepad input:

```js
a()              // press A briefly
b()              // press B
right(500)       // hold right d-pad for 500 ms
hold('right')    // hold indefinitely; pair with release()
release()
axes(1, 0, 0, 0) // left stick: full right
seq([['right', 200], ['a', 50]])
```

When the native tvOS bridge isn't present, the helpers just log the payload they would have sent — handy for sanity-checking sequences locally.

## Local development

Requires Node 22 (pinned in `.nvmrc`).

```bash
git clone --recurse-submodules https://github.com/greglamb/mkc-arcade-kiosk
cd mkc-arcade-kiosk
nvm use
npm install
npm test          # Jest suite (~98 tests across 9 files)
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
├── overrides/                              # ALL customizations live here
│   ├── public/
│   │   ├── native-gamepad-bridge.js        # frame-aware polyfill: drives carousel + games
│   │   ├── native-gamepad-test-helpers.js  # devtools console helpers (a(), right(), ...)
│   │   └── pxt-stub.js                     # mocks the upstream `pxt` global
│   ├── src/
│   │   ├── State/
│   │   │   ├── AppStateContext.tsx         # defaults locked=true (no "Add your game")
│   │   │   └── State.ts                    # initialAppState mirror with locked: true
│   │   ├── index.tsx                       # no-telemetry React bootstrap
│   │   └── pxt.d.ts                        # ambient TypeScript declarations
│   ├── tsconfig.paths.json                 # pins React to a single instance
│   ├── games.json                          # ← THE file you edit most
│   └── README.md
├── scripts/
│   ├── apply-overrides.sh                  # copies overrides + tweaks config.json
│   ├── inject-html.js
│   └── bump-submodule.sh
├── vendor/pxt/                             # pinned submodule, NEVER edit directly
├── tests/                                  # Jest tests (jsdom + node envs)
└── .github/
    ├── workflows/deploy.yml
    └── dependabot.yml
```

**The one rule that matters most:** never edit anything inside `vendor/pxt/`. All changes go in `overrides/` and are applied by `scripts/apply-overrides.sh` at build time. If you catch yourself opening a file under `vendor/pxt/`, stop and find (or add) the matching `overrides/` path.

The apply-overrides script also patches a few fields inside the submodule's working tree (gitignored, never committed):

- `kiosk/package.json` `homepage` → `"."` so CRA emits relative URLs.
- `kiosk/src/config.json` gamepad timing → `GamepadPollLoopMilli=16`, `GamepadOnDownCooldownMilli=150`, `GamepadOnHeldCooldownMilli=80`.
- `kiosk/public/index.html` → injects `<script>` tags for `pxt-stub.js`, `native-gamepad-bridge.js`, and `native-gamepad-test-helpers.js` (in that order).

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

## Further reading

- [`HANDOFF-TVOS.md`](HANDOFF-TVOS.md) — cross-repo handoff covering iframe-nesting discovery, gamepad protocol contract, sub-frame keyboard synthesis, and Apple TV debugging workflow. Read before touching `native-gamepad-bridge.js`.
- [`mkc-arcade-kiosk-SPEC.md`](mkc-arcade-kiosk-SPEC.md) — original architectural spec.
- [`overrides/README.md`](overrides/README.md) — override-system mechanics + game-adding workflow.
- [`docs/goodvibes/specs/`](docs/goodvibes/specs/) — per-feature design docs.
- [`CHANGELOG.md`](CHANGELOG.md) — user-facing changes per release.
- [`TODO.md`](TODO.md) — open work and tech debt.

## License

MIT — see [`LICENSE`](LICENSE).
