'use strict';

const fs = require('fs');
const path = require('path');

const gamesJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'overrides', 'games.json'), 'utf8')
);

// Three permitted MakeCode share-id formats. GitHub repo paths were dropped
// from games.json after the first deploy revealed the kiosk's runtime URL
// builder doesn't translate `org/repo` into a runnable MakeCode URL — see
// commit history around 2026-05-26 for the rollback rationale.
const SHARE_ID_20DIGIT = /^\d{5}-\d{5}-\d{5}-\d{5}$/;
const SHARE_ID_S_PREFIX = /^S\d{5}-\d{5}-\d{5}-\d{5}$/;
const SHARE_ID_PERSISTENT = /^_[a-zA-Z0-9]+$/;

function isValidId(id) {
  return SHARE_ID_20DIGIT.test(id)
      || SHARE_ID_S_PREFIX.test(id)
      || SHARE_ID_PERSISTENT.test(id);
}

describe('overrides/games.json', () => {
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

  test('every game id is a MakeCode share ID (no GitHub repo paths)', () => {
    // The kiosk's runtime URL builder treats id as a share ID, so non-share
    // formats fail at launch (404 from arcade.makecode.com/api/<id>/text).
    // Guard against accidentally re-adding github-style ids.
    const hasGithubPath = gamesJson.games.some(g => g.id.includes('/'));
    expect(hasGithubPath).toBe(false);
  });
});
