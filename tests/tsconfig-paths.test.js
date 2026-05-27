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

  // The react/* and react-dom/* aliases are intentional — they force every
  // `import "react"` in the bundle (kiosk source AND react-common) to resolve
  // to vendor/pxt/node_modules/react via react-app-alias-ex. Without them,
  // kiosk grabs its transitive react@18.2.0 from kiosk/node_modules while
  // react-common grabs vendor/pxt's — two physical instances, manifesting at
  // runtime as "Cannot read properties of null (reading 'useReducer')".
  test('keeps the react/* alias (single React instance discipline)', () => {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
    expect(paths['react/*']).toEqual(['../node_modules/react/*']);
  });

  test('keeps the react-dom/* alias (single ReactDOM instance discipline)', () => {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
    expect(paths['react-dom/*']).toEqual(['../node_modules/react-dom/*']);
  });

  test('keeps the react-common/* alias', () => {
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    const paths = (cfg.compilerOptions && cfg.compilerOptions.paths) || {};
    expect(paths['react-common/*']).toEqual(['../react-common/*']);
  });
});
