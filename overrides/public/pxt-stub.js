// pxt-stub.js — stub the upstream `pxt` global so mkc-arcade-kiosk runs
// standalone without the rest of the PXT framework.
//
// Responsibilities:
//   1. Provide pxt.targetConfigAsync() that returns our games from games.json.
//   2. Provide no-op telemetry (configurable for debugging).
//   3. Provide minimal Util helpers that Kiosk references.
//   4. Disable backend cloud calls (Kiosk ID flow is unused — we own the list).
//
// Load order: this MUST load before native-gamepad-bridge.js and before the
// CRA bundle, because Kiosk's App.tsx calls pxt.targetConfigAsync() on mount.
(function () {
  'use strict';

  if (window.pxt) {
    console.warn('[pxt-stub] window.pxt already exists; not overriding');
    return;
  }

  // ---- Debug toggle -----------------------------------------------------
  // Set via build-time env var MKC_DEBUG=true OR by adding ?mkcDebug=1 to URL.
  // When enabled, telemetry calls log to console and increment counters
  // accessible at window.__pxtStubStats.
  var DEBUG = (function () {
    try {
      // Build-time substitution placeholder. apply-overrides.sh replaces
      // %MKC_DEBUG% with the environment variable value at copy time.
      var fromEnv = ('%MKC_DEBUG%' === 'true');
      var fromUrl = /[?&]mkcDebug=1\b/.test(location.search);
      return fromEnv || fromUrl;
    } catch (e) { return false; }
  })();

  var stats = {
    tickEventCount: 0,
    reportErrorCount: 0,
    reportExceptionCount: 0,
    eventsByName: {},
  };

  if (DEBUG) {
    window.__pxtStubStats = stats;
    console.log('[pxt-stub] DEBUG enabled — stats at window.__pxtStubStats');
  }

  function tick(category) {
    stats.tickEventCount++;
    stats.eventsByName[category] = (stats.eventsByName[category] || 0) + 1;
    if (DEBUG) console.debug('[pxt.tickEvent]', category);
  }

  // ---- targetConfigAsync ------------------------------------------------
  // Kiosk's App.tsx calls this on mount and expects { kiosk: { games: [...] } }.
  // We resolve the path relative to document.baseURI so it works on:
  //   - GitHub Pages project URL: greglamb.github.io/mkc-arcade-kiosk/
  //   - Any custom domain
  //   - file:// URL when bundled inside a native shell
  var cachedConfig = null;
  function targetConfigAsync() {
    if (cachedConfig) return Promise.resolve(cachedConfig);
    var url = new URL('games.json', document.baseURI).href;
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('games.json HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var games = (data && Array.isArray(data.games)) ? data.games : [];
        if (DEBUG) console.log('[pxt-stub] loaded', games.length, 'games');
        cachedConfig = { kiosk: { games: games } };
        return cachedConfig;
      })
      .catch(function (err) {
        console.error('[pxt-stub] games.json load failed:', err);
        cachedConfig = { kiosk: { games: [] } };
        return cachedConfig;
      });
  }

  // ---- The stub ---------------------------------------------------------
  window.pxt = {
    targetConfigAsync: targetConfigAsync,
    tickEvent: function (cat) { tick(cat); },
    debug: function () { if (DEBUG) console.debug.apply(console, arguments); },
    log:   function () { if (DEBUG) console.log.apply(console, arguments); },
    reportError: function (cat, msg) {
      stats.reportErrorCount++;
      console.error('[pxt.reportError]', cat, msg);
    },
    reportException: function (e) {
      stats.reportExceptionCount++;
      console.error('[pxt.reportException]', e);
    },
    // Kiosk's BackendRequests.ts uses pxt.Cloud.apiRoot to talk to Microsoft's
    // kiosk code service. We point it at about:blank so any accidental
    // invocation fails loudly rather than leaking data.
    Cloud: { apiRoot: 'about:blank' },
    Util: {
      escapeForRegex: function (s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      },
    },
  };

  if (DEBUG) console.log('[pxt-stub] installed');
})();
