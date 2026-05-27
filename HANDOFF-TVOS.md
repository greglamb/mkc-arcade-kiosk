# HANDOFF-TVOS — context from the native shell side

**Date:** 2026-05-27
**Status:** ✅ **RESOLVED — kept as a historical record.** The cross-repo work documented below shipped. The polyfill in `overrides/public/native-gamepad-bridge.js` now has recursive postMessage fanout, gamepad→keyboard event synthesis in sub-frames, automatic pxsim unmuting, and the `#safari-mute-button-outer` overlay is suppressed. Console test helpers (`a()`, `b()`, `right(500)`, `axes(...)`, `seq(...)`) ship in `overrides/public/native-gamepad-test-helpers.js`.

**Audience:** the agent working in `mkc-arcade-kiosk` (the web kiosk repo)
**From:** the agent working in `mkc-arcade-kiosk-tvos` (the native tvOS shell that loads this kiosk)

This file exists because there's coordinated work happening across two repos. Recent commits to `overrides/public/native-gamepad-bridge.js` here came from the native-shell side discovering issues during Apple TV testing, not from typical kiosk-web work. Read this before touching `native-gamepad-bridge.js` so you don't accidentally undo something we just learned the hard way.

---

## 1. What the native shell is

The native shell is `mkc-arcade-kiosk-tvos` (sibling repo at `~/Repositories/elliotgames/mkc-arcade-kiosk-tvos`). It's a tvOS app that:

1. Sideloads onto Greg's family Apple TV (paid developer cert, NOT App Store)
2. Uses a private-API trick to instantiate `WKWebView` on tvOS (Apple doesn't publicly ship WebKit on tvOS for App Store apps)
3. Loads `https://greglamb.github.io/mkc-arcade-kiosk/?lock=1` fullscreen
4. Bridges real Bluetooth game controllers (Xbox/DualSense/MFi via `GameController.framework`) and the Siri Remote (via `UIPress` → virtual gamepad) into the W3C Gamepad API the kiosk page expects

The native shell relies on this kiosk repo's `native-gamepad-bridge.js` being the JS-side counterpart of the protocol.

---

## 2. The iframe-nesting discovery (this is the load-bearing context)

When the kiosk launches a game, the resulting frame structure is:

```
greglamb.github.io          (parent — the kiosk SPA)
└── arcade.makecode.com     (iframe 1 — pxt simulator wrapper, name="--run")
    └── trg-arcade.userpxt.io  (iframe 2 — actual game runtime, name="sim-frame-NNNN")
```

Three levels. All three are cross-origin to each other. JS in one frame **cannot** inject scripts into another (CORS).

**The pxt simulator inside iframe 2 does NOT poll `navigator.getGamepads()`.** Confirmed by grep: zero references to the Gamepad API anywhere in `vendor/pxt/pxtsim/`. The game runtime listens for **keyboard events** on `window`/`document`. The deepest iframe has a `<canvas id="game-screen" tabindex="0" role="application">` and a `window.onkeydown` handler.

So for gamepad input to drive the game:

1. Native shell pushes gamepad state into the top frame via `window.__nativeGamepadUpdate(payload)`
2. Top frame's polyfill updates local `navigator.getGamepads()` AND forwards to its iframes via `postMessage`
3. Each iframe applies the update locally AND forwards to ITS iframes (recursive — needed because of the 2-level nesting)
4. The deepest iframe (where the game runs) **also synthesizes keyboard events** from the polyfilled gamepad state, dispatching them on `window`/`document` so the game sees them

That last step is what's mid-implementation as of this handoff.

---

## 3. Recent commits in this repo (and why)

| Commit | Why |
|---|---|
| `2222c8c fix(overrides): make gamepad bridge frame-aware for iframe simulators` | First-pass frame awareness — the polyfill checks `window === window.top` and behaves differently in main vs sub-frames |
| `0a1bbe1 docs(changelog): note iframe gamepad fix` | CHANGELOG entry for above |

### Uncommitted right now (the in-flight change)

```
M overrides/public/native-gamepad-bridge.js
```

This file currently has the **recursive fanout** baked in (every frame forwards updates to its own iframes via postMessage — not just the main frame) and needs the **gamepad → keyboard event synthesis** added next.

---

## 4. The protocol — keep these matched on both sides

The native shell injects a parallel JS polyfill via `WKUserScript` (from Obj-C source in `mkc-arcade-kiosk-tvos/_Project/Browser/GameWebView.m`, function `MkcGamepadPolyfillScript`). Both the native-injected polyfill and the kiosk's HTML-injected one must use the **same protocol** because both run in the main frame (the second-loaded one wins via JS variable shadowing — usually the kiosk's, since it loads after the native WKUserScript).

The contract:

- Native shell exposes `window.webkit.messageHandlers.gameController` (only in main frame)
- Polyfill (main frame) signals readiness with `bridge.postMessage({type: 'polyfill_ready'})` once installed
- Native shell receives `polyfill_ready` and starts pushing state via `window.__nativeGamepadUpdate(payload)`
- Payload format: `[ {id, buttons:[17 floats], axes:[4 floats]} | null, null, null, null ]` (4 slots, W3C Standard Gamepad layout)
- Polyfill in main frame: applies update locally + postMessages `{tag: '__mkcGamepadUpdate', payload}` to every direct iframe
- Polyfill in sub-frame: listens for that message, applies update locally + postMessages to ITS direct iframes (recursion handles arbitrary nesting depth)

### What's about to be added (next step)

In sub-frame branch only, after applying the update, synthesize keyboard events for each button state transition:

| W3C button index | Keyboard event |
|---|---|
| 0 (A) | `Space` (keyCode 32) |
| 1 (B) | `Enter` (keyCode 13) |
| 8 (Back) | `Escape` (keyCode 27) |
| 9 (Start) | `2` (keyCode 50) |
| 12 (D-pad Up) | `ArrowUp` (38) |
| 13 (D-pad Down) | `ArrowDown` (40) |
| 14 (D-pad Left) | `ArrowLeft` (37) |
| 15 (D-pad Right) | `ArrowRight` (39) |

(Source: `kiosk/src/config.json` → `VirtualGamepadMaps[0]`.)

Dispatch on both `window` and `document`, with `bubbles: true, cancelable: true`. Track previous button states (per index) to fire `keydown` on press transition, `keyup` on release transition.

**Main frame does NOT synthesize keyboard events** — the kiosk's `GamepadManager.ts` already polls `navigator.getGamepads()` and dispatches its own synthetic keys for carousel navigation. Doing it again from the polyfill would double-input.

---

## 5. Why NOT just modify pxtsim instead

We considered patching `vendor/pxt/pxtsim/embed.ts` to accept a "gamepad" message type. Rejected because:

- `vendor/pxt` is a git submodule pinned to upstream — divergence makes upstream syncs painful
- The pxt simulator is also used outside the kiosk context; adding kiosk-specific protocols there pollutes the wider pxt ecosystem
- An iframe-side polyfill is self-contained and lives in `overrides/` (the kiosk's existing extension point)

If you ever find yourself reaching for pxtsim changes, prefer adding to `overrides/` first.

---

## 6. Testing this locally

The Jest test suite covers main-frame behavior only (jsdom doesn't simulate iframe nesting cleanly). Run with:

```bash
npx jest tests/native-gamepad-bridge.test.js
```

11 tests, all pass on the current uncommitted version. The new iframe-side synthesis isn't covered by tests yet — could be added with mocked `KeyboardEvent.dispatchEvent` assertions and a faked `window.top` to simulate sub-frame context.

End-to-end testing requires running the native shell on a real Apple TV or in the tvOS 26.5 simulator (older sims crash on the WKWebView private API). Then Safari → Develop → [device] → mkc-arcade-kiosk-tvos opens a Web Inspector that lets you switch between frames via a dropdown in the bottom-left of the Console pane. The two iframes show up as `--run` and `sim-frame-NNNN`.

---

## 7. Deploy

GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys this repo to GitHub Pages on push to `main`. The native shell loads the deployed URL at runtime, so changes here take effect on Apple TVs without re-deploying the native app — but the native shell ALSO injects its own version of `native-gamepad-bridge.js` as a `WKUserScript`, so both versions are present at runtime. The kiosk's HTML-injected one runs second and wins via variable shadowing. Keep both versions consistent.

---

## 8. Cross-references

- Native shell repo: `~/Repositories/elliotgames/mkc-arcade-kiosk-tvos`
- Native shell's HANDOFF: `~/Repositories/elliotgames/mkc-arcade-kiosk-tvos/HANDOFF.md` (more detailed; read if you want the full picture)
- Native shell's polyfill source: `mkc-arcade-kiosk-tvos/_Project/Browser/GameWebView.m` (search `MkcGamepadPolyfillScript`)
- The kiosk's gamepad-key-mapping reference: `vendor/pxt/kiosk/src/config.json` → `VirtualGamepadMaps`
- The kiosk's iframe element (where the game launches): `vendor/pxt/kiosk/src/Components/PlayingGame.tsx`
- The kiosk's existing gamepad polling (parent-side carousel input): `vendor/pxt/kiosk/src/Services/GamepadManager.ts`

If you're picking this up cold, start there.
