// overrides/src/pxt.d.ts
//
// Ambient declarations for the minimal `pxt` global surface used by the
// kiosk source tree. Implemented at runtime by overrides/public/pxt-stub.js
// (before the CRA bundle loads) and overrides/src/index.tsx (at boot).
//
// When a Dependabot pxt-submodule bump introduces a new pxt.* reference,
// the kiosk build will fail with TS2304/TS2339. Extend this file with the
// declaration AND extend pxt-stub.js with a no-op runtime — see
// project-standards § "Submodule discipline" for the post-bump checklist.

declare global {
    // Standalone localization helper. Used 50+ times across kiosk source.
    // Our pxt-stub.js implementation does simple {N}-placeholder interpolation
    // with no translation table — kiosk is English-only.
    function lf(template: string, ...args: unknown[]): string;

    namespace pxt {
        // Runtime config — set by overrides/src/index.tsx before App mounts.
        let appTarget: TargetBundle;
        let webConfig: WebConfig;
        let options: { debug: boolean };

        // Telemetry — no-ops in pxt-stub.js (debug-loggable, never network).
        function tickEvent(id: string, data?: Map<string | number>): void;
        function reportError(cat: string, msg: string, data?: object): void;
        function reportException(err: unknown, data?: object): void;

        // Target config download — pxt-stub.js returns the contents of
        // /games.json wrapped in { kiosk: { games: [...] } }.
        function targetConfigAsync(): Promise<TargetConfig | undefined>;

        type Map<T> = { [k: string]: T };

        interface TargetBundle {
            id: string;
            name: string;
            versions: { target: string; pxt: string };
            appTheme: Map<any>;
            // `any` (not `unknown`) so kiosk code can read arbitrary fields
            // off the bundle without per-site narrowing. This is a shim, not
            // a contract.
            [k: string]: any;
        }

        interface WebConfig {
            relprefix: string;
            verprefix: string;
            workerjs: string;
            runUrl?: string;
            [k: string]: any;
        }

        interface TargetConfig {
            kiosk?: {
                games: Array<{
                    id: string;
                    name: string;
                    description: string;
                    highScoreMode: string;
                }>;
            };
            [k: string]: any;
        }

        namespace Cloud {
            let apiRoot: string;
            // Type-only — used in BackendRequests.ts. Permissive shape.
            interface JsonScript { [k: string]: any }
        }

        namespace BrowserUtils {
            function isLocalHost(): boolean;
            function isMobile(): boolean;
        }

        namespace Utils {
            function escapeForRegex(s: string): string;
        }
    }

    // pxt-compiler namespace. Only pxtc.BuiltSimJsInfo is referenced at type-
    // position by kiosk source (PlayingGame.tsx, IndexedDb.ts). Permissive
    // shape — the kiosk treats these as opaque records.
    namespace pxtc {
        interface BuiltSimJsInfo {
            [k: string]: unknown;
        }
    }
}

export {};
