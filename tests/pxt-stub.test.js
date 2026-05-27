/**
 * @jest-environment jsdom
 */

'use strict';

function loadStub() {
  jest.resetModules();
  // The stub is plain browser JS — re-require to re-run its IIFE.
  // require returns module.exports (empty), but the side effect is what we want.
  require('../overrides/public/pxt-stub.js');
}

beforeEach(() => {
  delete window.pxt;
  delete window.__pxtStubStats;
  // Default fetch mock — tests override per case.
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ games: [] }),
    })
  );
});

describe('pxt-stub', () => {
  test('defines window.pxt if not already present', () => {
    loadStub();
    expect(window.pxt).toBeDefined();
    expect(typeof window.pxt.targetConfigAsync).toBe('function');
  });

  test('does not override window.pxt if already present', () => {
    window.pxt = { sentinel: 'preexisting' };
    loadStub();
    expect(window.pxt).toEqual({ sentinel: 'preexisting' });
  });

  test('tickEvent is callable and returns undefined', () => {
    loadStub();
    expect(window.pxt.tickEvent('ui.kiosk.start')).toBeUndefined();
  });

  test('tickEvent does NOT expose stats when DEBUG=false', () => {
    loadStub();
    window.pxt.tickEvent('x');
    expect(window.__pxtStubStats).toBeUndefined();
  });

  test('Cloud.apiRoot is about:blank (no network)', () => {
    loadStub();
    expect(window.pxt.Cloud.apiRoot).toBe('about:blank');
  });

  test('Util.escapeForRegex escapes regex metacharacters', () => {
    loadStub();
    expect(window.pxt.Util.escapeForRegex('a.b*c')).toBe('a\\.b\\*c');
    expect(window.pxt.Util.escapeForRegex('foo')).toBe('foo');
  });

  test('targetConfigAsync returns { kiosk: { games } } from games.json', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ games: [{ id: '1', name: 'X' }] }),
      })
    );
    loadStub();
    const cfg = await window.pxt.targetConfigAsync();
    expect(cfg).toEqual({ kiosk: { games: [{ id: '1', name: 'X' }] } });
  });

  test('targetConfigAsync caches its result', async () => {
    loadStub();
    await window.pxt.targetConfigAsync();
    await window.pxt.targetConfigAsync();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('targetConfigAsync returns empty games on fetch failure', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('boom')));
    loadStub();
    const cfg = await window.pxt.targetConfigAsync();
    expect(cfg).toEqual({ kiosk: { games: [] } });
  });

  test('targetConfigAsync returns empty games on non-OK HTTP', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
    );
    loadStub();
    const cfg = await window.pxt.targetConfigAsync();
    expect(cfg).toEqual({ kiosk: { games: [] } });
  });

  test('reportError increments local counter and logs', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadStub();
    window.pxt.reportError('cat', 'msg');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  test('reportException increments local counter and logs', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    loadStub();
    window.pxt.reportException(new Error('x'));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  describe('BrowserUtils namespace', () => {
    test('isLocalHost() returns false', () => {
      loadStub();
      expect(typeof window.pxt.BrowserUtils.isLocalHost).toBe('function');
      expect(window.pxt.BrowserUtils.isLocalHost()).toBe(false);
    });
  });

  describe('Utils namespace', () => {
    test('escapeForRegex aliases the existing Util.escapeForRegex', () => {
      loadStub();
      expect(typeof window.pxt.Utils.escapeForRegex).toBe('function');
      expect(window.pxt.Utils.escapeForRegex).toBe(
        window.pxt.Util.escapeForRegex
      );
    });

    test('Utils.escapeForRegex escapes regex metacharacters correctly', () => {
      loadStub();
      expect(window.pxt.Utils.escapeForRegex('a.b*c')).toBe('a\\.b\\*c');
    });
  });

  describe('DEBUG mode (?mkcDebug=1)', () => {
    test('exposes stats at window.__pxtStubStats when URL has ?mkcDebug=1', () => {
      window.history.replaceState({}, '', '/?mkcDebug=1');
      loadStub();
      expect(window.__pxtStubStats).toBeDefined();
      expect(window.__pxtStubStats.tickEventCount).toBe(0);
      window.pxt.tickEvent('foo.bar');
      expect(window.__pxtStubStats.tickEventCount).toBe(1);
      expect(window.__pxtStubStats.eventsByName['foo.bar']).toBe(1);
    });

    test('debug() and log() forward to console when DEBUG=true', () => {
      window.history.replaceState({}, '', '/?mkcDebug=1');
      const dbgSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      loadStub();
      window.pxt.debug('hello');
      window.pxt.log('world');
      expect(dbgSpy).toHaveBeenCalledWith('hello');
      expect(logSpy).toHaveBeenCalledWith('world');
      dbgSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('lf() localization helper', () => {
    test('returns the template when no placeholders', () => {
      loadStub();
      expect(window.lf('plain text')).toBe('plain text');
    });

    test('interpolates {N} placeholders with arguments', () => {
      loadStub();
      expect(window.lf('hello {0}', 'world')).toBe('hello world');
      expect(window.lf('{1} then {0}', 'A', 'B')).toBe('B then A');
    });

    test('replaces missing or null arguments with empty string', () => {
      loadStub();
      expect(window.lf('x{0}y', null)).toBe('xy');
      expect(window.lf('x{0}y', undefined)).toBe('xy');
      expect(window.lf('x{0}y')).toBe('xy');
    });
  });
});
