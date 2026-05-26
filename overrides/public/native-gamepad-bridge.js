// native-gamepad-bridge.js — bridges a host WebView's native game controllers
// into the page's navigator.getGamepads() API.
//
// In a regular browser, this script no-ops and the real Gamepad API is used.
// In a native shell (detected via window.webkit.messageHandlers.gameController),
// it overrides getGamepads() and the host pushes state via __nativeGamepadUpdate.
//
// Load order: this MUST load before the CRA bundle, because Kiosk's
// GamepadManager.initialize() calls getGamepads() once at startup.
(function () {
  'use strict';

  var HANDLER_NAME = 'gameController';
  var bridge = window.webkit
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers[HANDLER_NAME];

  if (!bridge) {
    // No native shell. Let the real Gamepad API work normally.
    return;
  }

  console.log('[native-gamepad-bridge] Installing (native shell detected)');

  var MAX_PADS = 4;
  var padStates = new Array(MAX_PADS).fill(null);

  /**
   * Build a W3C Standard Gamepad object from a raw state payload.
   *
   * The native side sends:
   *   {
   *     id: string,            // human-readable name
   *     buttons: number[17],   // each 0..1, standard mapping order
   *     axes:    number[4]     // each -1..+1, [leftX, leftY, rightX, rightY]
   *   }
   *
   * Standard button index reference (W3C Gamepad spec):
   *   0=A, 1=B, 2=X, 3=Y,
   *   4=L1, 5=R1, 6=L2, 7=R2,
   *   8=Select/Back, 9=Start,
   *   10=L3, 11=R3,
   *   12=DPadUp, 13=DPadDown, 14=DPadLeft, 15=DPadRight,
   *   16=Home/Guide
   */
  function build(index, raw) {
    return {
      id: raw.id || ('Native Controller ' + index + ' (STANDARD GAMEPAD)'),
      index: index,
      connected: true,
      mapping: 'standard',
      timestamp: performance.now(),
      buttons: raw.buttons.map(function (v) {
        return {
          pressed: v > 0.5,
          touched: v > 0.0,
          value: v,
        };
      }),
      axes: raw.axes.slice(0, 4),
      vibrationActuator: null,
      hapticActuators: [],
    };
  }

  /**
   * Native shell calls this on every controller state change.
   * Accepts JSON string or pre-parsed array of length MAX_PADS.
   * Fires gamepadconnected/gamepaddisconnected events on slot transitions.
   */
  window.__nativeGamepadUpdate = function (payload) {
    try {
      var incoming = typeof payload === 'string' ? JSON.parse(payload) : payload;
      for (var i = 0; i < MAX_PADS; i++) {
        var prev = padStates[i];
        var next = incoming[i] ? build(i, incoming[i]) : null;

        if (!prev && next) {
          window.dispatchEvent(new GamepadEvent('gamepadconnected', { gamepad: next }));
        } else if (prev && !next) {
          window.dispatchEvent(new GamepadEvent('gamepaddisconnected', { gamepad: prev }));
        }
        padStates[i] = next;
      }
    } catch (e) {
      console.error('[native-gamepad-bridge] update failed:', e);
    }
  };

  // Override the Gamepad API. Kiosk's GamepadManager polls this every
  // GamepadPollLoopMilli (50ms by default).
  navigator.getGamepads = function () { return padStates; };

  // Signal native that the polyfill is ready and it can push initial state.
  try {
    bridge.postMessage({ type: 'polyfill_ready' });
  } catch (e) {
    console.error('[native-gamepad-bridge] ready signal failed:', e);
  }
})();
