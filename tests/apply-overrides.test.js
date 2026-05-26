/**
 * @jest-environment node
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'apply-overrides.sh');
const ROOT_REAL = path.resolve(__dirname, '..');

function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mkc-fake-'));
  // Mirror only what apply-overrides.sh needs: overrides/ and vendor/pxt/kiosk/.
  fs.mkdirSync(path.join(root, 'overrides', 'public'), { recursive: true });
  fs.mkdirSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });

  // Copy override sources from the real repo.
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'public', 'pxt-stub.js'),
    path.join(root, 'overrides', 'public', 'pxt-stub.js')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'public', 'native-gamepad-bridge.js'),
    path.join(root, 'overrides', 'public', 'native-gamepad-bridge.js')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'games.json'),
    path.join(root, 'overrides', 'games.json')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'scripts', 'apply-overrides.sh'),
    path.join(root, 'scripts', 'apply-overrides.sh')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'scripts', 'inject-html.js'),
    path.join(root, 'scripts', 'inject-html.js')
  );
  fs.chmodSync(path.join(root, 'scripts', 'apply-overrides.sh'), 0o755);

  // Fake kiosk package.json (minimum required fields).
  fs.writeFileSync(
    path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'),
    JSON.stringify({ name: 'pxt-kiosk', version: '0.0.0', homepage: 'OLD' }, null, 2) + '\n'
  );

  // Fake kiosk index.html.
  fs.writeFileSync(
    path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'),
    '<html><head>\n  <title>Kiosk</title>\n</head><body></body></html>'
  );

  return root;
}

function runScript(root, env = {}) {
  execFileSync(path.join(root, 'scripts', 'apply-overrides.sh'), [], {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'pipe',
  });
}

describe('apply-overrides.sh', () => {
  test('copies override files into vendor/pxt/kiosk/public/', () => {
    const root = makeFakeRoot();
    runScript(root);
    const kioskPublic = path.join(root, 'vendor', 'pxt', 'kiosk', 'public');
    expect(fs.existsSync(path.join(kioskPublic, 'pxt-stub.js'))).toBe(true);
    expect(fs.existsSync(path.join(kioskPublic, 'native-gamepad-bridge.js'))).toBe(true);
    expect(fs.existsSync(path.join(kioskPublic, 'games.json'))).toBe(true);
  });

  test('substitutes %MKC_DEBUG% with the env value (default false)', () => {
    const root = makeFakeRoot();
    runScript(root);
    const stub = fs.readFileSync(
      path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'),
      'utf8'
    );
    expect(stub).not.toContain('%MKC_DEBUG%');
    expect(stub).toContain("'false' === 'true'");
  });

  test('substitutes %MKC_DEBUG% with "true" when env says so', () => {
    const root = makeFakeRoot();
    runScript(root, { MKC_DEBUG: 'true' });
    const stub = fs.readFileSync(
      path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'),
      'utf8'
    );
    expect(stub).toContain("'true' === 'true'");
  });

  test('sets package.json homepage to "."', () => {
    const root = makeFakeRoot();
    runScript(root);
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'), 'utf8')
    );
    expect(pkg.homepage).toBe('.');
  });

  test('injects both <script> tags into index.html before </head>', () => {
    const root = makeFakeRoot();
    runScript(root);
    const html = fs.readFileSync(
      path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'),
      'utf8'
    );
    expect(html).toContain('<!-- mkc-arcade-kiosk injected -->');
    expect(html).toContain('pxt-stub.js');
    expect(html).toContain('native-gamepad-bridge.js');
  });

  test('is idempotent — running twice produces no further diff', () => {
    const root = makeFakeRoot();
    runScript(root);
    const snapshot = {
      stub: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'), 'utf8'),
      bridge: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'native-gamepad-bridge.js'), 'utf8'),
      games: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'games.json'), 'utf8'),
      pkg: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'), 'utf8'),
      html: fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'), 'utf8'),
    };
    runScript(root);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'pxt-stub.js'), 'utf8')).toBe(snapshot.stub);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'native-gamepad-bridge.js'), 'utf8')).toBe(snapshot.bridge);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'games.json'), 'utf8')).toBe(snapshot.games);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'package.json'), 'utf8')).toBe(snapshot.pkg);
    expect(fs.readFileSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public', 'index.html'), 'utf8')).toBe(snapshot.html);
  });

  test('fails fast if the submodule is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mkc-empty-'));
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.copyFileSync(
      path.join(ROOT_REAL, 'scripts', 'apply-overrides.sh'),
      path.join(root, 'scripts', 'apply-overrides.sh')
    );
    fs.chmodSync(path.join(root, 'scripts', 'apply-overrides.sh'), 0o755);
    expect(() => runScript(root)).toThrow();
  });
});
