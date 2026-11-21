#!/usr/bin/env bash
T="${1:?usage: bash apply.sh /path/to/Knome.mi}"; H="$(cd "$(dirname "$0")" && pwd)"
[ -d "$T/llama.cpp" ] || { echo "Not a Knome.mi folder: $T"; exit 1; }
( cd "$H/files" && find . -type f ) | while read -r f; do mkdir -p "$T/$(dirname "$f")"; cp "$H/files/$f" "$T/$f"; done
chmod +x "$T"/tools/*.sh "$T"/appimage/AppRun 2>/dev/null
echo "Patch 42 applied: Knome's own window (app/). Build:  bash tools/build-native-app.sh   (see docs/NATIVE.md)"
