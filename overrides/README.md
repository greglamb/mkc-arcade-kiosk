# overrides/

This directory holds all customizations applied to the upstream `microsoft/pxt`
submodule at build time. Never edit files inside `vendor/pxt/` — they will be
overwritten on the next build and any changes you make there will be lost when
the submodule is bumped.

## Files

- `public/native-gamepad-bridge.js` — gamepad API polyfill for native shells
- `public/pxt-stub.js` — replaces the upstream `pxt` global, serves games.json
- `src/index.tsx` — no-telemetry kiosk bootstrap (replaces upstream's React mount)
- `src/pxt.d.ts` — ambient TypeScript declarations for the `pxt` global
- `tsconfig.paths.json` — pins react/react-dom to a single instance via aliases
- `games.json` — the kiosk's game list (THE file you edit most often)

## Adding a game

1. Open the game on [arcade.makecode.com](https://arcade.makecode.com).
2. Click **Share**, give it a title, click **Share Project**.
3. Copy the share ID from the URL (after `arcade.makecode.com/`). Three formats
   are accepted by `games.json`:
   - 20-digit numeric: `12345-67890-12345-67890`
   - S-prefix: `S12345-67890-12345-67890`
   - Persistent (underscore-prefix): `_aBcDeF`
4. Add an entry to `games.json`:

   ```json
   {
     "id": "S12345-67890-12345-67890",
     "name": "Display name",
     "description": "One-sentence description.",
     "highScoreMode": "SingleAscending"
   }
   ```

5. `highScoreMode` is `"SingleAscending"` (higher = better) or `"None"`.
6. Commit and push `games.json`. The Pages workflow rebuilds automatically.

### What about GitHub repos?

GitHub-hosted MakeCode projects (e.g. `gigglyparrot/starfox`) are NOT
directly playable from `games.json` at runtime — the kiosk's URL builder
passes the id straight to `arcade.makecode.com/api/<id>/text`, and that
endpoint only resolves share IDs.

To use a GitHub-hosted game:

1. Open [arcade.makecode.com](https://arcade.makecode.com).
2. Click **Import** → **Import URL**, paste the GitHub repo URL, click Import.
3. Wait for MakeCode to build the project.
4. Click **Share** → **Share Project** to get a share ID.
5. Use that share ID in `games.json` (per the steps above).

If you really want to skip the import-and-share step for GitHub games, the
kiosk would need a runtime URL translator (see TODO.md Tech Debt).

## Removing a game

Just remove its entry from `games.json` and push.
