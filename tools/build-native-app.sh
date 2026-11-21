#!/usr/bin/env bash
# tools/build-native-app.sh -- builds Knome's own window (app/src-tauri, Rust + the system webview).
#   bash tools/build-native-app.sh          -> app/src-tauri/target/release/knome-app
# Then:   ./app/src-tauri/target/release/knome-app      (starts Knome and shows it in its own window)
#   or:   bash tools/build-appimage.sh                  (the AppImage then opens in this window)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/app/src-tauri" || { echo "app/src-tauri missing (apply Patch 42)"; exit 1; }
if ! command -v cargo >/dev/null 2>&1; then
    echo " xx Rust is missing. Install it:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   (then open a new terminal)"; exit 1
fi
if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
    echo " xx The window library is missing. Install it (Debian / Ubuntu / KDE neon):"
    echo "    sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev libssl-dev librsvg2-dev libxdo-dev"
    exit 1
fi
cargo build --release || { echo " xx build failed (send me the last lines)"; exit 1; }
echo
echo "  Done:  $ROOT/app/src-tauri/target/release/knome-app"
echo "  Needs at run time:  sudo apt install libwebkit2gtk-4.1-0"
