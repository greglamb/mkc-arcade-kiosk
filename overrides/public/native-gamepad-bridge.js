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
// Architecture (recursive — handles arbitrary iframe nesting depth):
//   Native pushes via `window.__nativeGamepadUpdate(payload)` to main frame
//     → main frame applies update locally, postMessages to its iframes
//     → each iframe applies update locally, postMessages to ITS iframes
//     → recurse until leaf frames
//
// The MakeCode Arcade simulator is a TWO-LEVEL iframe nest
// (parent → arcade.makecode.com → trg-arcade.userpxt.io), so recursive
// fanout is required — direct-children-only fanout would never reach the
// actual game runtime.
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

  // W3C button index → keyboard event mapping. Source: `kiosk/src/config.json`
  // VirtualGamepadMaps[0]. The pxt simulator inside the deepest iframe listens
  // for keyboard events on window/document, not gamepad input, so sub-frames
  // synthesize key events from the polyfilled pad state.
  var BUTTON_KEYS = {
    0:  { key: ' ',          code: 'Space',      keyCode: 32 },  // A
    1:  { key: 'Enter',      code: 'Enter',      keyCode: 13 },  // B
    8:  { key: 'Escape',     code: 'Escape',     keyCode: 27 },  // Back
    9:  { key: '2',          code: 'Digit2',     keyCode: 50 },  // Start
    12: { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38 },
    13: { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40 },
    14: { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37 },
    15: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  };

  var prevPressed = new Array(17).fill(false);

  function fireKey(type, mapping) {
    var ev = new KeyboardEvent(type, {
      key: mapping.key,
      code: mapping.code,
      keyCode: mapping.keyCode,
      which: mapping.keyCode,
      bubbles: true,
      cancelable: true,
    });
    // Dispatch on document only — KeyboardEvent bubbles, so window listeners
    // still see it. Firing on both caused window handlers to run twice.
    try { document.dispatchEvent(ev); } catch (e) { /* ignore */ }
  }

  function syncKeysFromPad(pad) {
    for (var i = 0; i < 17; i++) {
      var mapping = BUTTON_KEYS[i];
      if (!mapping) continue;
      var nowPressed = pad ? pad.buttons[i].pressed : false;
      if (nowPressed && !prevPressed[i]) {
        fireKey('keydown', mapping);
      } else if (!nowPressed && prevPressed[i]) {
        fireKey('keyup', mapping);
      }
      prevPressed[i] = nowPressed;
    }
  }

  // Forward an update to every child iframe (called from both the main frame
  // and every sub-frame to support recursive nesting).
  function forwardToChildren(incoming) {
    var iframes = document.querySelectorAll('iframe');
    for (var j = 0; j < iframes.length; j++) {
      try {
        iframes[j].contentWindow.postMessage(
          { tag: POSTMSG_TAG, payload: incoming },
          '*'
        );
      } catch (e) { /* iframe not yet loaded; safe to ignore */ }
    }
  }

  // Polyfill `navigator.getGamepads()` in every frame.
  navigator.getGamepads = function () { return pads; };

  if (isMainFrame) {
    console.log('[native-gamepad-bridge] main frame: installing (native shell detected)');

    // Native pushes state here. Apply locally then propagate to children.
    window.__nativeGamepadUpdate = function (payload) {
      try {
        var incoming = typeof payload === 'string' ? JSON.parse(payload) : payload;
        applyUpdate(incoming);
        forwardToChildren(incoming);
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

    // Hide the makecode editor wrapper's Safari-specific "Unmute simulator"
    // overlay button. We auto-unmute pxsim below, so the user never needs to
    // click it — leaving it visible just shows a confusing red speaker-with-X
    // over the game.
    try {
      var hideStyle = document.createElement('style');
      hideStyle.textContent = '#safari-mute-button-outer { display: none !important; }';
      (document.head || document.documentElement).appendChild(hideStyle);
    } catch (e) { /* document not ready yet — rare in user-script injection */ }

    // The arcade.makecode.com editor mutes the pxt simulator by default (for
    // browser autoplay-policy compliance). pxsim.mute(false) is idempotent and
    // internally calls ctx.resume() on the audio context. We also notify the
    // parent so its mute-button UI updates — pxsim only fires
    // setParentMuteState on its own transitions, not when we flip the flag
    // externally. Returns true once unmuted, used to stop the poll interval.
    function tryUnmutePxsim() {
      try {
        if (typeof pxsim === 'undefined' || !pxsim.AudioContextManager) return false;
        if (pxsim.AudioContextManager.isMuted && !pxsim.AudioContextManager.isMuted()) return true;
        pxsim.AudioContextManager.mute(false);
        if (pxsim.setParentMuteState) pxsim.setParentMuteState('unmuted');
        return true;
      } catch (e) { return false; }
    }

    // Poll for pxsim every 250ms — it loads lazily after our document_start
    // polyfill runs. Stop when unmuted, or after 30 seconds for frames that
    // never host pxsim (e.g. the makecode wrapper itself).
    var unmuteInterval = setInterval(function () {
      if (tryUnmutePxsim()) { clearInterval(unmuteInterval); }
    }, 250);
    setTimeout(function () { clearInterval(unmuteInterval); }, 30000);

    // Sub-frame: apply parent's update locally, synthesize keyboard events for
    // the pxt simulator running here, forward to our own iframes (recurse —
    // handles nested simulators like MakeCode's pxt → userpxt), and try to
    // unmute pxsim opportunistically.
    //
    // Main frame does NOT synthesize keys — the kiosk's GamepadManager already
    // polls navigator.getGamepads() and dispatches its own synthetic keys for
    // carousel navigation. Doubling up would cause spurious inputs.
    window.addEventListener('message', function (e) {
      if (e.data && e.data.tag === POSTMSG_TAG && e.data.payload) {
        applyUpdate(e.data.payload);
        syncKeysFromPad(pads[0]);
        forwardToChildren(e.data.payload);
        tryUnmutePxsim();
      }
    });
  }
})();
