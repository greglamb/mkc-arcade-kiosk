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
  fs.mkdirSync(path.join(root, 'overrides', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'overrides', 'src', 'State'), { recursive: true });
  fs.mkdirSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'public'), { recursive: true });
  fs.mkdirSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'vendor', 'pxt', 'kiosk', 'src', 'State'), { recursive: true });
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
    path.join(ROOT_REAL, 'overrides', 'src', 'index.tsx'),
    path.join(root, 'overrides', 'src', 'index.tsx')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'src', 'pxt.d.ts'),
    path.join(root, 'overrides', 'src', 'pxt.d.ts')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'tsconfig.paths.json'),
    path.join(root, 'overrides', 'tsconfig.paths.json')
  );
  fs.copyFileSync(
    path.join(ROOT_REAL, 'overrides', 'src', 'State', 'State.ts'),
    path.join(root, 'overrides', 'src', 'State', 'State.ts')
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

  // Seed .nvmrc so the script's Node-version gate finds it (added in
  // E-T1; the fake root must mirror the real ROOT layout the gate reads).
  fs.copyFileSync(
    path.join(ROOT_REAL, '.nvmrc'),
    path.join(root, '.nvmrc')
  );

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
    // Seed .nvmrc so the Node-version gate doesn't short-circuit before the
    // submodule check runs (this test's contract is "submodule missing", not
    // "no .nvmrc").
    fs.copyFileSync(
      path.join(ROOT_REAL, '.nvmrc'),
      path.join(root, '.nvmrc')
    );
    expect(() => runScript(root)).toThrow();
  });
});

describe('Node version gate', () => {
  const { spawnSync } = require('child_process');

  let tmpdir;

  beforeEach(() => {
    tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'mkc-node-gate-'));
  });

  afterEach(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  test('exits 1 with a clear message when node major mismatches .nvmrc', () => {
    const fakeNode = path.join(tmpdir, 'node');
    fs.writeFileSync(fakeNode, '#!/bin/bash\necho v99.0.0\n', { mode: 0o755 });

    const result = spawnSync(SCRIPT, [], {
      env: { ...process.env, PATH: `${tmpdir}:${process.env.PATH}` },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Node 99\.x running, \.nvmrc requires 22\.x/);
  });

  test('exits 1 when node --version produces no parseable output', () => {
    // Simulates the "node not on PATH" case: a fake `node` that prints
    // nothing leaves ACTUAL_NODE_MAJOR empty, which the gate treats the
    // same as a missing node binary. (A literally-empty PATH would also
    // break the script's #!/usr/bin/env bash shebang, so we can't test
    // that case directly — but the gate's behavior is identical.)
    const fakeNode = path.join(tmpdir, 'node');
    fs.writeFileSync(fakeNode, '#!/bin/bash\nexit 0\n', { mode: 0o755 });

    const result = spawnSync(SCRIPT, [], {
      env: { ...process.env, PATH: `${tmpdir}:${process.env.PATH}` },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/'node' not on PATH/);
  });
});

describe('Source-tree override copy steps', () => {
  test('copies overrides/src/index.tsx to vendor/pxt/kiosk/src/index.tsx', () => {
    const root = makeFakeRoot();
    runScript(root);
    const dest = path.join(root, 'vendor', 'pxt', 'kiosk', 'src', 'index.tsx');
    const src = path.join(ROOT_REAL, 'overrides', 'src', 'index.tsx');
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe(fs.readFileSync(src, 'utf8'));
  });

  test('copies overrides/src/pxt.d.ts to vendor/pxt/kiosk/src/pxt.d.ts', () => {
    const root = makeFakeRoot();
    runScript(root);
    const dest = path.join(root, 'vendor', 'pxt', 'kiosk', 'src', 'pxt.d.ts');
    const src = path.join(ROOT_REAL, 'overrides', 'src', 'pxt.d.ts');
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe(fs.readFileSync(src, 'utf8'));
  });

  test('copies overrides/tsconfig.paths.json to vendor/pxt/kiosk/tsconfig.paths.json', () => {
    const root = makeFakeRoot();
    runScript(root);
    const dest = path.join(root, 'vendor', 'pxt', 'kiosk', 'tsconfig.paths.json');
    const src = path.join(ROOT_REAL, 'overrides', 'tsconfig.paths.json');
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe(fs.readFileSync(src, 'utf8'));
  });

  test('copies overrides/src/State/State.ts to vendor/pxt/kiosk/src/State/State.ts', () => {
    const root = makeFakeRoot();
    runScript(root);
    const dest = path.join(root, 'vendor', 'pxt', 'kiosk', 'src', 'State', 'State.ts');
    const src = path.join(ROOT_REAL, 'overrides', 'src', 'State', 'State.ts');
    expect(fs.existsSync(dest)).toBe(true);
    expect(fs.readFileSync(dest, 'utf8')).toBe(fs.readFileSync(src, 'utf8'));
  });

  test('State.ts override sets locked: true (hides Add-your-game button)', () => {
    const text = fs.readFileSync(
      path.join(ROOT_REAL, 'overrides', 'src', 'State', 'State.ts'),
      'utf8'
    );
    expect(text).toMatch(/locked:\s*true/);
    expect(text).not.toMatch(/locked:\s*false/);
  });

  test('is idempotent for the new copy steps (second run is a no-op)', () => {
    const root = makeFakeRoot();
    runScript(root);
    const snap = fs.readFileSync(
      path.join(root, 'vendor', 'pxt', 'kiosk', 'src', 'index.tsx'),
      'utf8'
    );
    runScript(root);
    expect(
      fs.readFileSync(
        path.join(root, 'vendor', 'pxt', 'kiosk', 'src', 'index.tsx'),
        'utf8'
      )
    ).toBe(snap);
  });
});

describe('.gitignore', () => {
  const text = fs.readFileSync(path.join(ROOT_REAL, '.gitignore'), 'utf8');

  test.each([
    'vendor/pxt/kiosk/src/index.tsx',
    'vendor/pxt/kiosk/src/pxt.d.ts',
    'vendor/pxt/kiosk/src/State/State.ts',
    'vendor/pxt/kiosk/tsconfig.paths.json',
  ])('ignores submodule destination %s', (entry) => {
    expect(text).toContain(entry);
  });
});
