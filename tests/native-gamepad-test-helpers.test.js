/**
 * @jest-environment jsdom
 */

'use strict';

function loadHelpers() {
  jest.resetModules();
  require('../overrides/public/native-gamepad-test-helpers.js');
}

beforeEach(() => {
  jest.useFakeTimers();
  delete window.__nativeGamepadUpdate;
  // Strip globals the helpers install so each test gets a clean window.
  ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'back', 'start',
   'l3', 'r3', 'up', 'down', 'left', 'right', 'home',
   'press', 'hold', 'release', 'axes', 'seq', 'help', 'gp'
  ].forEach(name => { delete window[name]; });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('native-gamepad-test-helpers', () => {
  test('installs bare globals and gp namespace on load', () => {
    loadHelpers();
    expect(typeof window.a).toBe('function');
    expect(typeof window.right).toBe('function');
    expect(typeof window.press).toBe('function');
    expect(typeof window.hold).toBe('function');
    expect(typeof window.release).toBe('function');
    expect(typeof window.axes).toBe('function');
    expect(typeof window.seq).toBe('function');
    expect(typeof window.help).toBe('function');
    expect(window.gp).toBeDefined();
    expect(typeof window.gp.right).toBe('function');
    expect(window.gp.BUTTONS.right).toBe(15);
  });

  test('press(name) sends a payload with that button high, then low after delay', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    window.right(200);
    // First call: button 15 pressed.
    expect(window.__nativeGamepadUpdate).toHaveBeenCalledTimes(1);
    const first = window.__nativeGamepadUpdate.mock.calls[0][0];
    expect(first[0].buttons[15]).toBe(1);
    expect(first[1]).toBeNull();
    // After timeout: button 15 released.
    jest.advanceTimersByTime(200);
    expect(window.__nativeGamepadUpdate).toHaveBeenCalledTimes(2);
    const second = window.__nativeGamepadUpdate.mock.calls[1][0];
    expect(second[0].buttons[15]).toBe(0);
  });

  test('press(["a", "right"]) sends a combo payload', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    window.press(['a', 'right'], 100);
    const payload = window.__nativeGamepadUpdate.mock.calls[0][0];
    expect(payload[0].buttons[0]).toBe(1);   // A
    expect(payload[0].buttons[15]).toBe(1);  // right
  });

  test('hold() keeps a button down until release()', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    window.hold('right');
    expect(window.__nativeGamepadUpdate.mock.calls[0][0][0].buttons[15]).toBe(1);
    jest.advanceTimersByTime(5000);
    // No release scheduled — only one call so far.
    expect(window.__nativeGamepadUpdate).toHaveBeenCalledTimes(1);
    window.release();
    const released = window.__nativeGamepadUpdate.mock.calls[1][0];
    expect(released[0].buttons[15]).toBe(0);
  });

  test('axes(lx, ly, rx, ry) sets stick axes and persists until release()', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    window.axes(0.5, -1, 0, 0);
    expect(window.__nativeGamepadUpdate.mock.calls[0][0][0].axes).toEqual([0.5, -1, 0, 0]);
    window.release();
    expect(window.__nativeGamepadUpdate.mock.calls[1][0][0].axes).toEqual([0, 0, 0, 0]);
  });

  test('release() clears held buttons AND held axes', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    window.hold('up');
    window.axes(1, 0, 0, 0);
    window.release();
    const final = window.__nativeGamepadUpdate.mock.calls.at(-1)[0];
    expect(final[0].buttons[12]).toBe(0);
    expect(final[0].axes).toEqual([0, 0, 0, 0]);
  });

  test('seq runs steps in order with default ms', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    window.seq(['right', 'a'], 100);
    // First step starts immediately.
    expect(window.__nativeGamepadUpdate.mock.calls[0][0][0].buttons[15]).toBe(1);
    // After 100ms the press auto-releases.
    jest.advanceTimersByTime(100);
    // 20ms inter-step gap then second step starts.
    jest.advanceTimersByTime(20);
    expect(window.__nativeGamepadUpdate.mock.calls.at(-1)[0][0].buttons[0]).toBe(1);
  });

  test('unknown button name throws', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    expect(() => window.press('nope')).toThrow(/Unknown button: nope/);
  });

  test('logs payload when native bridge is absent (no throw)', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    loadHelpers();
    expect(() => window.a()).not.toThrow();
    // The "no bridge" warning was logged on init.
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('native bridge not present'));
    // The first call to a() logs the would-be payload.
    expect(logSpy.mock.calls.some(args =>
      typeof args[0] === 'string' && args[0].indexOf('(no native bridge) would send') !== -1
    )).toBe(true);
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test('button names are case-insensitive', () => {
    window.__nativeGamepadUpdate = jest.fn();
    loadHelpers();
    window.press('Right', 50);
    expect(window.__nativeGamepadUpdate.mock.calls[0][0][0].buttons[15]).toBe(1);
  });
});
