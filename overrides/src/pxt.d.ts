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
            appTheme: Map<unknown>;
            [k: string]: unknown;
        }

        interface WebConfig {
            relprefix: string;
            verprefix: string;
            workerjs: string;
            [k: string]: unknown;
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
            [k: string]: unknown;
        }

        namespace Cloud {
            let apiRoot: string;
        }

        namespace BrowserUtils {
            function isLocalHost(): boolean;
        }

        namespace Utils {
            function escapeForRegex(s: string): string;
        }
    }
}

export {};
