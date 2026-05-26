/**
 * @jest-environment jsdom
 */

'use strict';

function loadBridge() {
  jest.resetModules();
  require('../overrides/public/native-gamepad-bridge.js');
}

function rawPad(overrides) {
  return Object.assign(
    {
      id: 'Test Pad',
      buttons: new Array(17).fill(0),
      axes: [0, 0, 0, 0],
    },
    overrides || {}
  );
}

beforeEach(() => {
  delete window.webkit;
  delete window.__nativeGamepadUpdate;
  // Restore the real getGamepads if a previous test overrode it.
  if (navigator.getGamepads && navigator.getGamepads.__bridgePolyfill) {
    delete navigator.getGamepads;
  }
});

describe('native-gamepad-bridge', () => {
  test('no-ops when window.webkit.messageHandlers.gameController is undefined', () => {
    loadBridge();
    expect(window.__nativeGamepadUpdate).toBeUndefined();
  });

  test('installs polyfill when native shell handler is present', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    expect(typeof window.__nativeGamepadUpdate).toBe('function');
    expect(typeof navigator.getGamepads).toBe('function');
  });

  test('signals polyfill_ready to the native bridge', () => {
    const postMessage = jest.fn();
    window.webkit = { messageHandlers: { gameController: { postMessage } } };
    loadBridge();
    expect(postMessage).toHaveBeenCalledWith({ type: 'polyfill_ready' });
  });

  test('navigator.getGamepads returns an array of length 4', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const pads = navigator.getGamepads();
    expect(Array.isArray(pads)).toBe(true);
    expect(pads).toHaveLength(4);
  });

  test('all slots are null before any update', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    expect(navigator.getGamepads()).toEqual([null, null, null, null]);
  });

  test('update populates slot 0 when a single pad is sent', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    window.__nativeGamepadUpdate([rawPad(), null, null, null]);
    const pads = navigator.getGamepads();
    expect(pads[0]).not.toBeNull();
    expect(pads[0].mapping).toBe('standard');
    expect(pads[0].connected).toBe(true);
    expect(pads[1]).toBeNull();
  });

  test('null -> object slot transition dispatches gamepadconnected', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const onConnect = jest.fn();
    window.addEventListener('gamepadconnected', onConnect);
    window.__nativeGamepadUpdate([rawPad(), null, null, null]);
    expect(onConnect).toHaveBeenCalledTimes(1);
    const evt = onConnect.mock.calls[0][0];
    expect(evt.gamepad.index).toBe(0);
  });

  test('object -> null slot transition dispatches gamepaddisconnected', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const onDisconnect = jest.fn();
    window.addEventListener('gamepaddisconnected', onDisconnect);
    window.__nativeGamepadUpdate([rawPad(), null, null, null]);
    window.__nativeGamepadUpdate([null, null, null, null]);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  test('button value > 0.5 reports pressed=true', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const buttons = new Array(17).fill(0);
    buttons[0] = 0.7;
    buttons[1] = 0.4;
    window.__nativeGamepadUpdate([rawPad({ buttons }), null, null, null]);
    const pad = navigator.getGamepads()[0];
    expect(pad.buttons[0].pressed).toBe(true);
    expect(pad.buttons[0].value).toBe(0.7);
    expect(pad.buttons[1].pressed).toBe(false);
    expect(pad.buttons[1].value).toBe(0.4);
  });

  test('accepts JSON string payload', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const payload = JSON.stringify([rawPad(), null, null, null]);
    window.__nativeGamepadUpdate(payload);
    expect(navigator.getGamepads()[0]).not.toBeNull();
  });

  test('malformed payload logs but does not throw', () => {
    window.webkit = { messageHandlers: { gameController: { postMessage: jest.fn() } } };
    loadBridge();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => window.__nativeGamepadUpdate('{not json')).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
