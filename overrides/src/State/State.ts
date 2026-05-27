import {
    GameData,
    KioskState,
    AllHighScores,
    Notifications,
    ModalConfig,
} from "../Types";

export type AppState = {
    kioskState: KioskState;
    allGames: GameData[];
    mostRecentScores: number[];
    selectedGameId?: string;
    launchedGameId?: string;
    lockedGameId?: string;
    allHighScores: AllHighScores;
    kioskCode?: string;
    kioskCodeExpiration?: number;
    notifications: Notifications;
    modal?: ModalConfig;
    clean: boolean; // if true, don't load built-in games
    locked: boolean; // if true, hide the add games button
    time?: string; // lifetime of kiosk code, in minutes
    volume?: number; // volume level of kiosk UI sounds, in [0..1]
    targetConfig?: pxt.TargetConfig;
};

// Override: locked=true on startup so the "Add your game" button + the
// user-added-game removal UI stay hidden. The kiosk is admin-curated via
// overrides/games.json; players don't add games at runtime.
export const initialAppState: AppState = {
    kioskState: KioskState.MainMenu,
    allGames: [],
    mostRecentScores: [],
    allHighScores: {},
    notifications: [],
    clean: false,
    locked: true,
    time: "",
    volume: 0,
};
