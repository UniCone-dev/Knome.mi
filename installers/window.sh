#!/usr/bin/env bash
# installers/window.sh -- opens Knome in its OWN window (no tabs, no address bar) instead of a browser tab.
# Uses any Chromium-based browser in "app mode" (Chromium, Chrome, Brave, Edge, Vivaldi), with its own profile,
# so it never touches your normal browser. Closing the window stops Knome.
#   KNOME_WINDOW=app (default) | browser     KNOME_NO_BROWSER=1 = open nothing
knome_find_appbrowser() {
    local c
    for c in chromium chromium-browser google-chrome google-chrome-stable brave-browser brave microsoft-edge microsoft-edge-stable vivaldi vivaldi-stable; do
        command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return 0; }
    done
    for c in org.chromium.Chromium com.google.Chrome com.brave.Browser; do
        command -v flatpak >/dev/null 2>&1 && flatpak info "$c" >/dev/null 2>&1 && { echo "flatpak run $c"; return 0; }
    done
    return 1
}

# knome_open_window <url> <data dir> <pid to stop when the window closes>
knome_open_window() {
    local url="$1" data="$2" owner="$3" b
    [ "${KNOME_NO_BROWSER:-0}" = "1" ] && return 0
    (
        for _ in $(seq 1 180); do curl -fsS "$url" >/dev/null 2>&1 && break; sleep 1; done
        if [ "${KNOME_WINDOW:-app}" = "app" ] && b="$(knome_find_appbrowser)"; then
            # shellcheck disable=SC2086
            $b --app="$url" --user-data-dir="$data/app-profile" --class=Knome --name=Knome \
                --no-first-run --no-default-browser-check --window-size=1280,860 >/dev/null 2>&1
            # the window was closed -> stop Knome too
            pkill -TERM -P "$owner" 2>/dev/null; kill -TERM "$owner" 2>/dev/null
        else
            echo "  (no Chromium-based browser found for a separate window - opening your normal browser)"
            xdg-open "$url" >/dev/null 2>&1
        fi
    ) &
}
