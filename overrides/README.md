# overrides/

This directory holds all customizations applied to the upstream `microsoft/pxt`
submodule at build time. Never edit files inside `vendor/pxt/` — they will be
overwritten on the next build and any changes you make there will be lost when
the submodule is bumped.

## Files

- `public/native-gamepad-bridge.js` — gamepad API polyfill for native shells
- `public/pxt-stub.js` — replaces the upstream `pxt` global, serves games.json
- `games.json` — the kiosk's game list (THE file you edit most often)

## Adding a game

You have two options.

### Option A: From a GitHub-synced game (preferred for our games)

1. In MakeCode Arcade, open the game and use the GitHub icon to sync to a repo
2. The repo is public on GitHub (e.g., `greglamb/elliots-space-game`)
3. Add an entry to `games.json` using the repo path as the `id`:

   ```json
   {
     "id": "greglamb/elliots-space-game",
     "name": "Elliot's Space Adventure",
     "description": "Elliot's first game",
     "highScoreMode": "SingleAscending"
   }
   ```

4. Optionally pin to a tag or branch: `"id": "greglamb/elliots-space-game#v1.0"`.
   Without a suffix, the kiosk fetches the latest commit on the default branch
   every time the game is launched.

5. Commit and push `games.json`. The Pages workflow rebuilds automatically.

### Option B: From a share link (for community games or one-offs)

1. Open the game on [arcade.makecode.com](https://arcade.makecode.com)
2. Click **Share**, give it a title, click **Share Project**
3. Copy the share ID from the URL (after `arcade.makecode.com/`):
   - 20-digit format: `12345-67890-12345-67890`
   - Persistent format: `_aBcDeF`
4. Add an entry to `games.json`:

   ```json
   {
     "id": "12345-67890-12345-67890",
     "name": "Display name",
     "description": "One-sentence description",
     "highScoreMode": "SingleAscending"
   }
   ```

5. Commit and push.

### Choosing between A and B

- **Use A (GitHub repo)** if the game is one you can edit. The kiosk always
  loads the latest version. No need to re-share after every change.
- **Use B (share ID)** if the game is one you can't or don't want to track
  in your own repos (community games, MakeCode defaults).

## Removing a game

Just remove its entry from `games.json` and push.
