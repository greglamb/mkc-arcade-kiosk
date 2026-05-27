// native-gamepad-test-helpers.js
//
// Developer-console helpers for driving the native gamepad bridge from
// devtools. Always loaded — pollutes window with a small set of bare names
// (a, b, up, down, ...) plus a `gp` namespace.
//
// Built on top of native-gamepad-bridge.js — the helpers ultimately call
// window.__nativeGamepadUpdate(payload), the same entry point the native
// shell uses. If the native bridge isn't present (e.g. plain Safari), the
// helpers still load and log the payloads they *would* send, which is useful
// for verifying mappings during development.
//
// Quick reference (typed into the browser console):
//   a(), b(), up(), down(), left(), right(), start(), back(), home(), ...  — 150ms tap
//   a(500)                                  — hold A for 500ms
//   hold('right')                           — hold indefinitely
//   release()                               — release everything (buttons + sticks)
//   press(['a', 'right'], 300)              — combo
//   axes(0, 1, 0, 0)                        — analog sticks; hold until release()
//   seq([['right', 200], 'a'], 150)         — sequence of presses with per-step or default ms
//   help()                                  — re-print this list
//   gp.right(500)                           — namespaced equivalent of right(500)

(function () {
  'use strict';

  var BUTTONS = {
    a: 0, b: 1, x: 2, y: 3,
    l1: 4, r1: 5, l2: 6, r2: 7,
    back: 8, start: 9,
    l3: 10, r3: 11,
    up: 12, down: 13, left: 14, right: 15,
    home: 16,
  };

  // Persistent state: held buttons and current stick axes. press()/release()
  // and hold()/release() compose so you can hold one button, press another,
  // and the held one stays down.
  var heldButtons = Object.create(null);
  var heldAxes = [0, 0, 0, 0];

  function buildPayload() {
    var buttons = new Array(17).fill(0);
    Object.keys(heldButtons).forEach(function (i) { buttons[i] = 1; });
    return [
      { id: 'Test', buttons: buttons, axes: heldAxes.slice() },
      null, null, null,
    ];
  }

  function push() {
    var payload = buildPayload();
    if (typeof window.__nativeGamepadUpdate === 'function') {
      window.__nativeGamepadUpdate(payload);
    } else {
      console.log('[gamepad-test-helpers] (no native bridge) would send:', payload);
    }
  }

  function toIndex(name) {
    var idx = BUTTONS[String(name).toLowerCase()];
    if (typeof idx !== 'number') {
      throw new Error('Unknown button: ' + name);
    }
    return idx;
  }

  function press(name, ms) {
    ms = ms || 150;
    var names = Array.isArray(name) ? name : [name];
    var indices = names.map(toIndex);
    indices.forEach(function (i) { heldButtons[i] = true; });
    push();
    setTimeout(function () {
      indices.forEach(function (i) { delete heldButtons[i]; });
      push();
    }, ms);
    return '↳ ' + names.join('+') + ' for ' + ms + 'ms';
  }

  function hold(name) {
    var names = Array.isArray(name) ? name : [name];
    names.map(toIndex).forEach(function (i) { heldButtons[i] = true; });
    push();
    return '↳ holding ' + names.join('+') + ' — call release() to stop';
  }

  function release() {
    heldButtons = Object.create(null);
    heldAxes = [0, 0, 0, 0];
    push();
    return '↳ all released';
  }

  function axes(lx, ly, rx, ry) {
    heldAxes = [Number(lx) || 0, Number(ly) || 0, Number(rx) || 0, Number(ry) || 0];
    push();
    return '↳ axes set to [' + heldAxes.join(', ') + '] — call release() to clear';
  }

  // Runs a sequence of presses with delays between them. Each step is either
  // a button name (uses defaultMs) or [name, ms]. Returns immediately; presses
  // are scheduled via setTimeout chains.
  function seq(steps, defaultMs) {
    defaultMs = defaultMs || 150;
    var step = 0;
    function next() {
      if (step >= steps.length) return;
      var item = steps[step++];
      var name, ms;
      if (Array.isArray(item)) {
        name = item[0];
        ms = item[1] || defaultMs;
      } else {
        name = item;
        ms = defaultMs;
      }
      press(name, ms);
      // Small inter-step gap so the previous press's release fires before
      // the next press starts.
      setTimeout(next, ms + 20);
    }
    next();
    return '↳ running sequence of ' + steps.length + ' step(s)';
  }

  function help() {
    console.log('🎮 Gamepad test helpers loaded.');
    console.log('  Quick tap (150ms):   a(), b(), x(), y(), up(), down(), left(), right(),');
    console.log('                       start(), back(), home(), l1(), r1(), l2(), r2(), l3(), r3()');
    console.log('  Custom duration:     a(500)              — hold A for 500ms');
    console.log('  Indefinite hold:     hold("right")       — then release() when done');
    console.log('  Combo:               press(["a", "up"], 300)');
    console.log('  Analog stick:        axes(lx, ly, rx, ry) — values -1..+1; hold until release()');
    console.log('  Sequence:            seq([["right", 200], "a"], 150)');
    console.log('  Namespaced:          gp.right(500), gp.press(...), etc.');
    console.log('  Reset everything:    release()');
  }

  var api = {
    BUTTONS: BUTTONS,
    press: press,
    hold: hold,
    release: release,
    axes: axes,
    seq: seq,
    help: help,
  };

  Object.keys(BUTTONS).forEach(function (name) {
    var fn = function (ms) { return press(name, ms); };
    api[name] = fn;
    window[name] = fn;
  });

  window.press = press;
  window.hold = hold;
  window.release = release;
  window.axes = axes;
  window.seq = seq;
  window.help = help;
  window.gp = api;

  if (typeof window.__nativeGamepadUpdate !== 'function') {
    console.warn('[gamepad-test-helpers] native bridge not present — helpers will log payloads but cannot drive the page');
  }

  help();
})();
