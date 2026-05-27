'use strict';

// Idempotently insert the mkc-arcade-kiosk override <script> tags into the
// kiosk app's index.html, just before </head>. Replaces the multi-line `sed`
// approach from SPEC §4.8 because BSD sed (macOS) and GNU sed (CI) disagree
// on multi-line replacement semantics; Node is portable and already a build
// dependency.
//
// Load order matters: pxt-stub.js must come before native-gamepad-bridge.js,
// and all three must come before the CRA bundle. native-gamepad-test-helpers
// loads last because its functions call window.__nativeGamepadUpdate which is
// installed by the bridge.

const fs = require('fs');

const MARKER = '<!-- mkc-arcade-kiosk injected -->';

const INJECTION = [
  '    ' + MARKER,
  '    <script src="%PUBLIC_URL%/pxt-stub.js"></script>',
  '    <script src="%PUBLIC_URL%/native-gamepad-bridge.js"></script>',
  '    <script src="%PUBLIC_URL%/native-gamepad-test-helpers.js"></script>',
  '  ',
].join('\n');

function injectScripts(indexHtmlPath) {
  const original = fs.readFileSync(indexHtmlPath, 'utf8');

  if (original.includes(MARKER)) {
    // Already injected — no-op for idempotency.
    return;
  }

  const headCloseIdx = original.indexOf('</head>');
  if (headCloseIdx === -1) {
    throw new Error(
      'inject-html: could not find </head> in ' + indexHtmlPath
    );
  }

  const updated =
    original.slice(0, headCloseIdx) +
    INJECTION +
    original.slice(headCloseIdx);

  fs.writeFileSync(indexHtmlPath, updated, 'utf8');
}

module.exports = { injectScripts, MARKER };

// CLI entry: `node scripts/inject-html.js <path-to-index.html>`
if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: inject-html.js <path-to-index.html>');
    process.exit(2);
  }
  injectScripts(target);
}
