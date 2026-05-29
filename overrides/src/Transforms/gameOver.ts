import { stateAndDispatch } from "../State";
import { KioskState } from "../Types";
import { launchGame } from "./launchGame";
import { exitGame } from "./exitGame";
import { exitToEnterHighScore } from "./exitToEnterHighScore";

export function gameOver(skipHighScore?: boolean): void {
    // This is a hack to make sure all reducer actions have finished before referencing state. Otherwise, the state object may be out of date.
    // In this instance, `mostRecentScores` may not be populated yet, so we need to wait until the next frame to check it.
    setTimeout(() => {
        const { state } = stateAndDispatch();
        if (state.kioskState !== KioskState.PlayingGame) {
            return;
        }

        if (state.lockedGameId) {
            launchGame(state.lockedGameId);
            return;
        }

        const selectedGame = state.allGames.find(
            g => g.id === state.selectedGameId
        );

        // OVERRIDE: case-insensitive comparison. pxt-common-packages'
        // _mapScoreTypeToString returns lowercase ("none", "highscore",
        // "lowscore"); the upstream gate's strict `!== "None"` check never
        // matches and the high-score prompt always shows. Belt-and-suspenders
        // with the SimHostService override that prevents the clobber in the
        // first place — together either side alone would still leave a hole.
        const wantsHighScore =
            !skipHighScore &&
            selectedGame &&
            selectedGame.highScoreMode?.toLowerCase() !== "none" &&
            state.mostRecentScores?.length;

        if (wantsHighScore) {
            exitToEnterHighScore(selectedGame!.highScoreMode);
            return;
        }

        // OVERRIDE: For games without high-score tracking, auto-restart in
        // place instead of routing to the "Would you like to retry?" screen
        // (which remounts <PlayingGame>, which destroys the iframe and forces
        // a full simulator + game-binary reload). We send a `restart` command
        // to the simulator iframe via postMessage — pxtsim/embed.ts handles
        // this without reloading.
        //
        // The kiosk stays in KioskState.PlayingGame so the Back button still
        // exits to the carousel. The player sees the in-game GAME OVER splash
        // for ~2 seconds, then the game restarts. No iframe reload, no kiosk
        // GameOver screen.
        const simIframe = document.getElementsByTagName("iframe")[0] as HTMLIFrameElement | undefined;
        if (simIframe?.contentWindow) {
            simIframe.contentWindow.postMessage(
                { type: "simulator", command: "restart" },
                "*"
            );
            return;
        }

        // Fallback: if we can't find the iframe, fall through to the upstream
        // GameOver flow so the player at least gets an explicit Retry button.
        exitGame(KioskState.GameOver);
    }, 1);
}
