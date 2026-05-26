'use strict';

// jsdom doesn't implement GamepadEvent; provide a minimal stand-in.
if (typeof GamepadEvent === 'undefined') {
  global.GamepadEvent = class GamepadEvent extends Event {
    constructor(type, init) {
      super(type, init);
      this.gamepad = (init && init.gamepad) || null;
    }
  };
}
