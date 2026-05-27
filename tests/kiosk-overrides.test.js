/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('overrides/src/index.tsx (no-telemetry bootstrap)', () => {
  const file = path.join(__dirname, '..', 'overrides', 'src', 'index.tsx');
  let text;

  beforeAll(() => {
    text = fs.readFileSync(file, 'utf8');
  });

  describe('banned upstream calls (no-telemetry invariant)', () => {
    test.each([
      ['pxt.setupWebConfig', /pxt\.setupWebConfig\s*\(/],
      ['pxt.setAppTarget', /pxt\.setAppTarget\s*\(/],
      ['pxt.analytics.enable', /pxt\.analytics\.enable\s*\(/],
      ['pxt.worker.getWorker', /pxt\.worker\.getWorker\s*\(/],
    ])('does NOT call %s', (_label, pattern) => {
      expect(text).not.toMatch(pattern);
    });

    test('does NOT reassign pxt.Cloud.apiRoot', () => {
      expect(text).not.toMatch(/pxt\.Cloud\.apiRoot\s*=/);
    });
  });

  describe('required bootstrap', () => {
    test('renders App via ReactDOM.render under React.StrictMode', () => {
      expect(text).toMatch(/ReactDOM\.render\s*\(/);
      expect(text).toMatch(/React\.StrictMode/);
      expect(text).toMatch(/<App\s*\/>/);
    });

    test('listens for DOMContentLoaded before mounting', () => {
      expect(text).toMatch(/addEventListener\s*\(\s*["']DOMContentLoaded["']/);
    });

    test('toggles pxt.options.debug from URL', () => {
      expect(text).toMatch(/pxt\.options\s*=\s*pxt\.options\s*\|\|/);
      expect(text).toMatch(/pxt\.options\.debug\s*=/);
    });

    test('seeds pxt.appTarget and pxt.webConfig idempotently', () => {
      expect(text).toMatch(/pxt\.appTarget\s*=\s*pxt\.appTarget\s*\|\|/);
      expect(text).toMatch(/pxt\.webConfig\s*=\s*pxt\.webConfig\s*\|\|/);
    });
  });
});
