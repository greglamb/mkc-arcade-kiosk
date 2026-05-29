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
        if (
            !skipHighScore &&
            selectedGame &&
            selectedGame.highScoreMode?.toLowerCase() !== "none" &&
            state.mostRecentScores?.length
        ) {
            exitToEnterHighScore(selectedGame.highScoreMode);
        } else {
            exitGame(KioskState.GameOver);
        }
    }, 1);
}
