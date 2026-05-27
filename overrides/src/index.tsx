import React from "react";
import ReactDOM from "react-dom";
import "./Kiosk.css";
import App from "./App";
import { AppStateProvider } from "./State/AppStateContext";

// Kiosk-specific bootstrap.
//
// Deliberately does NOT call:
//   pxt.setupWebConfig    - would download a Microsoft web-config bundle
//   pxt.setAppTarget      - would parse upstream's TargetBundle wiring
//   pxt.analytics.enable  - would register an analytics provider
//   pxt.worker.getWorker  - would prefetch the makecode compiler worker
//
// Deliberately does NOT touch pxt.Cloud.apiRoot - that's pinned to
// "about:blank" by overrides/public/pxt-stub.js (load order: stub before
// bundle, per project-standards "Load order is part of the contract").

window.addEventListener("DOMContentLoaded", () => {
    pxt.options = pxt.options || ({} as { debug: boolean });
    pxt.options.debug = /[?&](dbg|mkcDebug)=1/i.test(window.location.href);

    pxt.appTarget = pxt.appTarget || ({
        id: "mkc-arcade-kiosk",
        name: "MKC Arcade Kiosk",
        versions: { target: "0.0.0", pxt: "0.0.0" },
        appTheme: {},
    } as pxt.TargetBundle);

    pxt.webConfig = pxt.webConfig || ({
        relprefix: "./",
        verprefix: "",
        workerjs: "./worker.js",
    } as pxt.WebConfig);

    ReactDOM.render(
        <React.StrictMode>
            <AppStateProvider>
                <App />
            </AppStateProvider>
        </React.StrictMode>,
        document.getElementById("root")
    );
});
