# ADDENDUM 01 — GitHub repo references in games.json

**Addendum to:** `mkc-arcade-kiosk-SPEC.md`
**Date:** 2026-05-26
**Status:** Required — implement alongside the base spec.
**Applies to:** `greglamb/mkc-arcade-kiosk` only. The tvOS repo is unaffected.

---

## Background

Greg syncs Elliot's MakeCode Arcade games to GitHub repositories rather than
relying solely on MakeCode share IDs. The base spec described `games.json`
entries using only the 20-digit share ID format (`12345-67890-12345-67890`)
or the persistent ID format (`_aBcDeF12345`).

MakeCode Arcade's `---run` endpoint also accepts GitHub repository paths as
the `id` parameter — this is how its educational integrations work. Supporting
this format in our self-hosted kiosk is one schema change, zero code change.

This addendum:

1. Extends the `games.json` schema to permit GitHub repo references
2. Updates the starter games list to demonstrate the hybrid pattern
3. Adds a validation step to confirm the kiosk's URL builder accepts the format
4. Adjusts the Jest test fixtures accordingly

---

## 1. Extended `id` field semantics

The `id` field in each `games.json` entry now permits THREE formats:

| Format | Example | Use case |
|---|---|---|
| Temporary share ID | `12345-67890-12345-67890` | Quick one-off shares, kiosk defaults |
| Persistent share ID | `_aBcDeF12345xyz` | Long-lived shares |
| GitHub repo path | `greglamb/elliots-space-game` | Version-controlled games (Greg's primary use) |
| GitHub repo @ ref | `greglamb/elliots-space-game#v1.0` | Pinned tag or branch (optional suffix) |

The MakeCode player runtime at `arcade.makecode.com/---run` handles all four
formats natively. No kiosk-side code changes are needed. The `id` value is
passed through `stringifyQueryString` in `PlayingGame.tsx` as-is and URL-encoded.

**Order of preference for Greg's use:**

1. GitHub repo reference for games Elliot authored
2. Persistent share ID for "permanent" community games we want to keep around
3. Temporary share ID only as a last resort or fallback

**Mixing formats in the same `games.json` is supported and expected.**

---

## 2. Updated starter `games.json`

Replace the contents of `overrides/games.json` with this. It demonstrates the
hybrid pattern (real share IDs as fallbacks, a documented GitHub repo
placeholder for Elliot's games).

```json
{
  "_comment": "Game list for the MakeCode Arcade Kiosk. Three id formats supported: (1) 20-digit share id e.g. '50225-04801-24334-14778', (2) persistent share id e.g. '_aBcDeF', (3) GitHub repo path e.g. 'greglamb/elliots-game' optionally with #ref suffix like 'greglamb/elliots-game#v1.0'. Replace the placeholder entries with Elliot's actual GitHub repos.",
  "games": [
    {
      "id": "greglamb/REPLACE-WITH-ELLIOTS-GAME-REPO",
      "name": "Elliot's Game (placeholder)",
      "description": "Replace this entry with one of Elliot's actual game repos",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "50225-04801-24334-14778",
      "name": "Space Destroyer",
      "description": "Use the lasers on your spaceship to shoot falling asteroids!",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "91201-59331-72477-53174",
      "name": "Bunny Hop!",
      "description": "Help your bunny hop over obstacles as they run through the forest",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "27640-75402-47530-91242",
      "name": "Hot Air Balloon",
      "description": "Navigate your hot air balloon through the mountains avoiding birds and spaceships",
      "highScoreMode": "SingleAscending"
    },
    {
      "id": "96744-30917-11312-43375",
      "name": "Falling Duck",
      "description": "Fly through the sky avoiding obstacles",
      "highScoreMode": "None"
    }
  ]
}
```

Notes:
- The placeholder entry intentionally references a non-existent repo so the
  validation in §4 can surface a "game not found" failure mode. Greg will
  replace it with a real repo before deploying.
- Microsoft's default share-ID games stay in the list as a working fallback.
  If Elliot's authored games ever fail to load, he still has games to play.
- The `_comment` field is invalid in strict JSON schemas but acceptable to
  parsers (`JSON.parse` ignores unknown keys at the object level). Kiosk's
  reducer reads `games[]` only, so `_comment` is harmless.

---

## 3. Updated `overrides/README.md`

Replace the "Adding a game" section in `overrides/README.md` with this
expanded version:

```markdown
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
```

---

## 4. Validation step

The base spec's §7 step 7 acceptance criteria should be augmented with this
additional check. Add the following bullet to the "Acceptance criteria" list:

> - With at least one entry in `games.json` using a GitHub repo `id` (e.g.,
>   `microsoft/pxt-arcade-bunny-hop` as a known-good test), pressing A on
>   that carousel tile loads the game without error. Verify by:
>     - Watching the Network tab: the iframe `src` should resolve to
>       `https://arcade.makecode.com/---run?id=microsoft%2Fpxt-arcade-bunny-hop&...`
>       (with `/` URL-encoded to `%2F`)
>     - The game compiles (may take longer than a share ID on first launch)
>       and becomes playable
>     - On subsequent launches, the compiled binary loads from IndexedDB cache

If this validation fails — i.e., the player doesn't accept the repo format —
file the failure and fall back to share IDs only. The placeholder entry in the
starter `games.json` should be removed in that case.

**Test repo to use for validation:**
`microsoft/pxt-sample-games-bunny-hop` (or any other public game repo from
Microsoft's MakeCode org). This is independent of Greg's personal repos so
the validation can be performed before he migrates his actual games.

If no public Microsoft game repo is available at the time of implementation,
fall back to validating by:
1. Going to `arcade.makecode.com`
2. Importing one of Microsoft's default games into a public personal repo
3. Using that repo path as the validation `id`

---

## 5. Updated Jest test for `games.json`

Replace the test in §6.3 of the base spec with this expanded version, which
permits all three id formats:

```javascript
// tests/games-json.test.js
const fs = require('fs');
const path = require('path');

describe('games.json', () => {
  const gamesJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'overrides', 'games.json'), 'utf8')
  );

  // Three permitted id formats
  const SHARE_ID_20DIGIT = /^\d{5}-\d{5}-\d{5}-\d{5}$/;
  const SHARE_ID_PERSISTENT = /^_[a-zA-Z0-9]+$/;
  const GITHUB_REPO = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+(?:#[\w./-]+)?$/;

  function isValidId(id) {
    return SHARE_ID_20DIGIT.test(id)
        || SHARE_ID_PERSISTENT.test(id)
        || GITHUB_REPO.test(id);
  }

  test('has top-level games array', () => {
    expect(Array.isArray(gamesJson.games)).toBe(true);
  });

  test.each(gamesJson.games)('game "$name" has all required fields', (game) => {
    expect(typeof game.id).toBe('string');
    expect(typeof game.name).toBe('string');
    expect(typeof game.description).toBe('string');
    expect(typeof game.highScoreMode).toBe('string');
  });

  test.each(gamesJson.games)('game "$name" has valid highScoreMode', (game) => {
    expect(['SingleAscending', 'None']).toContain(game.highScoreMode);
  });

  test.each(gamesJson.games)('game "$name" has valid id format', (game) => {
    expect(isValidId(game.id)).toBe(true);
  });

  test('contains at least one fallback share-id game', () => {
    // Belt-and-suspenders: ensure if all GitHub-backed games break,
    // there's still SOMETHING to play.
    const hasShareId = gamesJson.games.some(g =>
      SHARE_ID_20DIGIT.test(g.id) || SHARE_ID_PERSISTENT.test(g.id)
    );
    expect(hasShareId).toBe(true);
  });
});
```

The final test ("contains at least one fallback share-id game") is a
deliberate guard against Greg accidentally removing all share-ID fallbacks.
If Elliot ever wants to delete everything but his own games, this test will
fail and force a conscious decision to remove the safety net.

If Greg explicitly wants to disable this guard later, he should comment out
the test with a note rather than just deleting it.

---

## 6. Update §9 Final validation

Add this item to the final validation checklist in the base spec:

> 11. `games.json` contains a mix of GitHub repo references and share IDs.
>     Both load correctly when clicked. The Jest test
>     `games-json.test.js > contains at least one fallback share-id game`
>     passes.

---

## 7. Risks specific to GitHub-backed games

Append to §7 of the base spec:

| Risk | Mitigation |
|---|---|
| MakeCode's `---run` endpoint drops support for repo paths | Fallback to share IDs (covered by the test guard in §5 above). Validate during Dependabot bumps. |
| Repo is renamed or deleted on GitHub | Kiosk shows a load error for that tile only; other games unaffected. Greg notices and updates `games.json`. |
| Elliot pushes a broken commit | Pin the kiosk entry to a specific tag using `repo#tag` syntax. Greg moves the tag only after testing. |
| First-play compile takes longer than share IDs | Expected behavior. IndexedDB caches after first play. No mitigation needed unless it becomes a problem. |
| Repo must be public for MakeCode to fetch it | Acceptable for Elliot's projects. Document in `overrides/README.md`. |

---

## 8. Implementation note for the agent

If the agent is already mid-implementation, here is the minimum diff:

1. **`overrides/games.json`** — replace contents with the version in §2 above.
2. **`overrides/README.md`** — replace the "Adding a game" section with the
   expanded version from §3.
3. **`tests/games-json.test.js`** — use the version from §5 instead of the
   one in the base spec's §6.3.
4. **Add to `SPEC.md` step 7 acceptance criteria** — the GitHub repo
   validation step from §4 above.
5. **Add to `SPEC.md` §9 final validation** — item 11 from §6 above.
6. **Add to `SPEC.md` §7 risks** — the table in §7 above.

No new files. No structural changes. No build script changes. The override
script (`scripts/apply-overrides.sh`) doesn't need modification — it already
copies `games.json` to the kiosk public root unchanged.
