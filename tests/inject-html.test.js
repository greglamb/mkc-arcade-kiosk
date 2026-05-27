/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { injectScripts } = require('../scripts/inject-html.js');

function makeFixture(html) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-html-'));
  const file = path.join(dir, 'index.html');
  fs.writeFileSync(file, html, 'utf8');
  return file;
}

const BASE_HTML = '<html><head>\n  <title>Kiosk</title>\n</head><body></body></html>';
const MARKER = '<!-- mkc-arcade-kiosk injected -->';

describe('injectScripts', () => {
  test('inserts marker and three script tags before </head>', () => {
    const file = makeFixture(BASE_HTML);
    injectScripts(file);
    const out = fs.readFileSync(file, 'utf8');
    expect(out).toContain(MARKER);
    expect(out).toContain('%PUBLIC_URL%/pxt-stub.js');
    expect(out).toContain('%PUBLIC_URL%/native-gamepad-bridge.js');
    expect(out).toContain('%PUBLIC_URL%/native-gamepad-test-helpers.js');
    const markerIdx = out.indexOf(MARKER);
    const headCloseIdx = out.indexOf('</head>');
    expect(markerIdx).toBeLessThan(headCloseIdx);
  });

  test('inserts scripts in order: pxt-stub → bridge → test-helpers', () => {
    const file = makeFixture(BASE_HTML);
    injectScripts(file);
    const out = fs.readFileSync(file, 'utf8');
    const stubIdx = out.indexOf('pxt-stub.js');
    const bridgeIdx = out.indexOf('native-gamepad-bridge.js');
    const helpersIdx = out.indexOf('native-gamepad-test-helpers.js');
    expect(stubIdx).toBeGreaterThan(-1);
    expect(bridgeIdx).toBeGreaterThan(stubIdx);
    expect(helpersIdx).toBeGreaterThan(bridgeIdx);
  });

  test('is idempotent — second call leaves content unchanged', () => {
    const file = makeFixture(BASE_HTML);
    injectScripts(file);
    const afterFirst = fs.readFileSync(file, 'utf8');
    injectScripts(file);
    const afterSecond = fs.readFileSync(file, 'utf8');
    expect(afterSecond).toBe(afterFirst);
  });

  test('throws when </head> is missing', () => {
    const file = makeFixture('<html><body></body></html>');
    expect(() => injectScripts(file)).toThrow(/<\/head>/);
  });
});
