/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('overrides/tsconfig.paths.json', () => {
  const file = path.join(__dirname, '..', 'overrides', 'tsconfig.paths.json');

  test('file exists and parses as JSON', () => {
    expect(fs.existsSync(file)).toBe(true);
    const text = fs.readFileSync(file, 'utf8');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  test('drops the react/* alias (Tech Debt #2 fix)', () => {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
    expect(paths['react/*']).toBeUndefined();
  });

  test('drops the react-dom/* alias (Tech Debt #2 fix)', () => {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
    expect(paths['react-dom/*']).toBeUndefined();
  });

  test('keeps the react-common/* alias (defensive)', () => {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
    expect(paths['react-common/*']).toEqual(['../react-common/*']);
  });
});
