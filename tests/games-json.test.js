'use strict';

const fs = require('fs');
const path = require('path');

const gamesJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'overrides', 'games.json'), 'utf8')
);

// Three permitted id formats per ADDENDUM-01
const SHARE_ID_20DIGIT = /^\d{5}-\d{5}-\d{5}-\d{5}$/;
const SHARE_ID_PERSISTENT = /^_[a-zA-Z0-9]+$/;
const GITHUB_REPO = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9._-]+(?:#[\w./-]+)?$/;

function isValidId(id) {
  return SHARE_ID_20DIGIT.test(id)
      || SHARE_ID_PERSISTENT.test(id)
      || GITHUB_REPO.test(id);
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

  test('contains at least one fallback share-id game', () => {
    // Belt-and-suspenders: ensure if all GitHub-backed games break,
    // there's still SOMETHING to play. If you intentionally want to disable
    // this guard, comment it out with a note — don't just delete it.
    const hasShareId = gamesJson.games.some(g =>
      SHARE_ID_20DIGIT.test(g.id) || SHARE_ID_PERSISTENT.test(g.id)
    );
    expect(hasShareId).toBe(true);
  });
});
