// native-gamepad-bridge.js — bridges a host WebView's native game controllers
// into the page's navigator.getGamepads() API.
//
// Frame-aware: runs in BOTH the main kiosk frame and the cross-origin
// MakeCode simulator iframe. In the native shell, the iOS app injects this
// same script (via WKUserScript with forMainFrameOnly:NO) into every frame,
// guaranteeing both windows get a polyfilled `navigator.getGamepads`.
//
// In a regular browser without a native shell, this script no-ops in the
// main frame and the real Gamepad API works as usual.
//
// Architecture:
//   - Main frame:  receives gamepad state from native via
//                  `window.__nativeGamepadUpdate(payload)`, updates local
//                  polyfilled `navigator.getGamepads()`, AND forwards the
//                  payload to every child iframe via postMessage.
//   - Sub-frames:  listen for the parent's postMessage and update their own
//                  polyfilled `navigator.getGamepads()`. The MakeCode
//                  simulator polls getGamepads() and sees the state.
//
// Load order: this MUST load before the CRA bundle in the main frame because
// Kiosk's GamepadManager.initialize() calls getGamepads() once at startup.
//
// The protocol must match `MkcGamepadPolyfillScript` in the native shell's
// `GameWebView.m` (mkc-arcade-kiosk-tvos repo).
(function () {
  'use strict';

  var HANDLER_NAME = 'gameController';
  var MAX_PADS = 4;
  var POSTMSG_TAG = '__mkcGamepadUpdate';

  var isMainFrame = (window === window.top);
  var pads = new Array(MAX_PADS).fill(null);
  var bridge = window.webkit
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers[HANDLER_NAME];

  // Main frame without a native shell → let the real Gamepad API work.
  // (Sub-frames always install the polyfill listener; the parent's postMessage
  // delivers data only when a native shell is present.)
  if (isMainFrame && !bridge) {
    return;
  }

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

  function applyUpdate(incoming) {
    for (var i = 0; i < MAX_PADS; i++) {
      var prev = pads[i];
      var next = incoming[i] ? build(i, incoming[i]) : null;

      if (!prev && next) {
        try {
          window.dispatchEvent(new GamepadEvent('gamepadconnected', { gamepad: next }));
        } catch (e) { /* GamepadEvent unavailable in some iframe contexts */ }
      } else if (prev && !next) {
        try {
          window.dispatchEvent(new GamepadEvent('gamepaddisconnected', { gamepad: prev }));
        } catch (e) { /* same */ }
      }
      pads[i] = next;
    }
  }

  // Polyfill `navigator.getGamepads()` in every frame.
  navigator.getGamepads = function () { return pads; };

  if (isMainFrame) {
    console.log('[native-gamepad-bridge] main frame: installing (native shell detected)');

    // Native pushes state here. We update locally AND fan out to iframes via
    // postMessage so they can update their own polyfilled getGamepads().
    window.__nativeGamepadUpdate = function (payload) {
      try {
        var incoming = typeof payload === 'string' ? JSON.parse(payload) : payload;
        applyUpdate(incoming);
        var iframes = document.querySelectorAll('iframe');
        for (var j = 0; j < iframes.length; j++) {
          try {
            iframes[j].contentWindow.postMessage(
              { tag: POSTMSG_TAG, payload: incoming },
              '*'
            );
          } catch (e) { /* iframe not yet loaded; safe to ignore */ }
        }
      } catch (e) {
        console.error('[native-gamepad-bridge] update failed:', e);
      }
    };

    // Signal native that the polyfill is ready and it can push initial state.
    try {
      bridge.postMessage({ type: 'polyfill_ready' });
    } catch (e) {
      console.error('[native-gamepad-bridge] ready signal failed:', e);
    }
  } else {
    console.log('[native-gamepad-bridge] iframe: listening for parent updates');

    // Sub-frame: receive state from the parent's postMessage fanout.
    window.addEventListener('message', function (e) {
      if (e.data && e.data.tag === POSTMSG_TAG && e.data.payload) {
        applyUpdate(e.data.payload);
      }
    });
  }
})();
