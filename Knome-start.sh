#!/usr/bin/env bash
# ============================================================================
#  Knome-start.sh  --  the daily command.   Just run:  ./Knome-start.sh
#
#  - First time (or when something is missing / the UI changed) it runs
#    ./install.sh for you: install dependencies, build Knome and the image
#    server. After that it is instant.
#  - Then it starts BOTH servers:
#        Knome (text + tools)      http://127.0.0.1:8080
#        Image server (optional)   http://127.0.0.1:1234   (only if it was built)
#    and opens your browser. Ctrl+C stops everything.
#
#  Options:  --rebuild | --choose-backend | --backend X | --no-image   (passed to install.sh)
#            --settings     change context size / GPU layers / KV cache / port, then stop
#            --no-browser   do not open the browser
# ============================================================================
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

STATE_DIR="$SCRIPT_DIR/.knome-state"
UI_DIR="$SCRIPT_DIR/llama.cpp/tools/ui"
NEEDS_SETUP=0
PASS=()
for a in "$@"; do
    case "$a" in
        --rebuild|--choose-backend|--backend|--backend=*|--no-image|--yes|-y) NEEDS_SETUP=1; PASS+=("$a") ;;
        --settings) "$SCRIPT_DIR/install.sh" --settings; exit $? ;;
        --no-browser) export KNOME_NO_BROWSER=1 ;;
        -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) PASS+=("$a") ;;   # values of --backend X
    esac
done

[ -f "$STATE_DIR/setup-done" ] || NEEDS_SETUP=1
[ -x "$SCRIPT_DIR/llama.cpp/build/bin/llama-server" ] || NEEDS_SETUP=1
[ -f "$UI_DIR/dist/index.html" ] || NEEDS_SETUP=1
if [ -f "$UI_DIR/dist/index.html" ] && [ -n "$(find "$UI_DIR/src" "$UI_DIR/package.json" -newer "$UI_DIR/dist/index.html" -print -quit 2>/dev/null)" ]; then
    NEEDS_SETUP=1   # the UI sources changed (e.g. after a patch): rebuild it
fi
# image server source was added after the first setup
if [ -f "$SCRIPT_DIR/stable-diffusion.cpp/CMakeLists.txt" ] && [ ! -x "$SCRIPT_DIR/stable-diffusion.cpp/build/bin/sd-server" ] && [ ! -f "$STATE_DIR/no-image" ]; then
    NEEDS_SETUP=1
fi

if [ "$NEEDS_SETUP" = "1" ]; then
    chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null
    "$SCRIPT_DIR/install.sh" "${PASS[@]}" || exit $?
fi

# no model yet?
if ! compgen -G "$SCRIPT_DIR/models/*.gguf" >/dev/null 2>&1 && ! compgen -G "$SCRIPT_DIR/models/*/*.gguf" >/dev/null 2>&1; then
    printf '\n !! No text model found yet.\n    Put a .gguf model (and its mmproj file for vision) into:  %s/models/\n    Then run ./Knome-start.sh again.\n' "$SCRIPT_DIR"
    exit 0
fi

exec "$SCRIPT_DIR/start-knome.sh"
