#!/usr/bin/env bash
# ============================================================================
#  tools/build-appimage.sh  --  packs your finished Knome build into ONE file:
#                               build-appimage/Knome-<arch>.AppImage
#
#  Run it on YOUR computer after ./install.sh has built everything
#  (llama.cpp/build/bin/llama-server is needed, sd-server is optional):
#       bash tools/build-appimage.sh
#
#  What goes in:   llama-server (the web UI is inside it), sd-server, the tools (core-tools),
#                  the characters, the launcher (appimage/AppRun) and the libraries they need.
#  What stays out: models, memory, settings, python tools -> they live in ~/.local/share/Knome
#                  (the AppImage itself is read-only). The GPU driver / Vulkan comes from the system.
#
#  Tip: build on the OLDEST Linux you want to support (an AppImage runs on the same glibc or newer).
#  Needs internet once, to download appimagetool (or put `appimagetool` in your PATH / set APPIMAGETOOL=/path).
# ============================================================================
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1
ARCH="${ARCH:-$(uname -m)}"
OUT="$ROOT/build-appimage"
APPDIR="$OUT/Knome.AppDir"
SHARE="$APPDIR/usr/share/knome"
die()  { printf '\n xx %s\n' "$*" >&2; exit 1; }
step() { printf '\n==> %s\n' "$*"; }

LLAMA_BIN="$ROOT/llama.cpp/build/bin"
SD_BIN_DIR="$ROOT/stable-diffusion.cpp/build/bin"
[ -x "$LLAMA_BIN/llama-server" ] || die "llama-server is not built. Run ./install.sh first."
[ -f "$ROOT/appimage/AppRun" ] || die "appimage/AppRun is missing (apply Patch 40)."

step "Collecting files"
rm -rf "$APPDIR"; mkdir -p "$SHARE/llama.cpp/build/bin" "$SHARE/installers" "$APPDIR/usr/lib"
cp "$ROOT/start-knome.sh" "$SHARE/"
cp "$ROOT/installers/paths.sh" "$ROOT/installers/window.sh" "$ROOT/installers/settings.sh" "$SHARE/installers/"
cp -r "$ROOT/core-tools" "$SHARE/core-tools"
rm -rf "$SHARE/core-tools/venv" "$SHARE/core-tools/__pycache__"
[ -d "$ROOT/characters" ] && cp -r "$ROOT/characters" "$SHARE/characters" || mkdir -p "$SHARE/characters"
for f in LICENSE THIRD-PARTY-NOTICES.md; do [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$SHARE/"; done
cp "$LLAMA_BIN/llama-server" "$SHARE/llama.cpp/build/bin/"
cp -a "$LLAMA_BIN"/lib*.so* "$SHARE/llama.cpp/build/bin/" 2>/dev/null || true
BINS=("$SHARE/llama.cpp/build/bin/llama-server")
if [ -x "$SD_BIN_DIR/sd-server" ]; then
    mkdir -p "$SHARE/stable-diffusion.cpp/build/bin"
    cp "$SD_BIN_DIR/sd-server" "$SHARE/stable-diffusion.cpp/build/bin/"
    cp -a "$SD_BIN_DIR"/lib*.so* "$SHARE/stable-diffusion.cpp/build/bin/" 2>/dev/null || true
    BINS+=("$SHARE/stable-diffusion.cpp/build/bin/sd-server")
else
    echo "    (no sd-server found: this AppImage will have no image generation)"
fi
# the native window (built with tools/build-native-app.sh); optional. It needs libwebkit2gtk-4.1-0 on the system.
NATIVE_BIN="$ROOT/app/src-tauri/target/release/knome-app"
if [ -x "$NATIVE_BIN" ]; then mkdir -p "$APPDIR/usr/bin"; cp "$NATIVE_BIN" "$APPDIR/usr/bin/knome-app"; echo "    + native window (knome-app)"
else echo "    (no native window built: run  bash tools/build-native-app.sh  first for it; otherwise Knome opens a browser window)"; fi
cp "$ROOT/appimage/AppRun" "$APPDIR/AppRun"; cp "$ROOT/appimage/knome.desktop" "$APPDIR/knome.desktop"
chmod +x "$APPDIR/AppRun" "$SHARE/start-knome.sh" "${BINS[@]}"

step "Icon"
ICON=""
for c in "$ROOT/llama.cpp/tools/ui/static/pwa-512x512.png" "$ROOT/llama.cpp/tools/ui/static/pwa-192x192.png" "$ROOT/appimage/knome.png"; do
    [ -f "$c" ] && ICON="$c" && break
done
if [ -n "$ICON" ]; then cp "$ICON" "$APPDIR/knome.png"
else
    python3 - "$APPDIR/knome.png" <<'PY'
import struct, sys, zlib
n = 256; rows = b''
for y in range(n):
    rows += b'\x00' + b''.join(bytes((20 + 80 * x // n, 150, 110, 255)) for x in range(n))
def ch(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
open(sys.argv[1], 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(rows)) + ch(b'IEND', b''))
PY
    echo "    (no UI icon found, made a plain one)"
fi

step "Checking libraries"
# bundle shared libraries that are not part of every Linux (never libc, Vulkan/GL, X11/Wayland, GPU drivers)
SKIP='^(linux-vdso|ld-linux|libc\.|libm\.|libdl\.|libpthread|librt\.|libutil|libresolv|libnsl|libwebkit2gtk|libjavascriptcore|libgtk|libgdk|libsoup|libglib|libgobject|libgio|libgmodule|libcairo|libpango|libatk|libharfbuzz|libgdk_pixbuf|libfontconfig|libfreetype|libvulkan|libGL|libEGL|libOpenCL|libcuda|libnvidia|libX|libxcb|libwayland|libdrm|libamdhip|libhsa|libamd_comgr|libhipblas|librocblas|libcublas|libcudart|libnccl)'
bundle_deps() {
    local b="$1" line lib path
    while IFS= read -r line; do
        case "$line" in
            *"not found"*) echo "    MISSING for $(basename "$b"): $line"; MISSING=1; continue ;;
        esac
        lib="$(awk '{print $1}' <<<"$line")"; path="$(awk '/=>/ {print $3}' <<<"$line")"
        [ -n "$path" ] && [ -f "$path" ] || continue
        [[ "$(basename "$lib")" =~ $SKIP ]] && continue
        case "$path" in "$SHARE"/*) continue ;; esac
        [ -f "$APPDIR/usr/lib/$(basename "$path")" ] || { cp -L "$path" "$APPDIR/usr/lib/"; echo "    + $(basename "$path")"; }
    done < <(LD_LIBRARY_PATH="$(dirname "$b")" ldd "$b" 2>/dev/null)
}
MISSING=0
for b in "${BINS[@]}"; do bundle_deps "$b"; done
[ "$MISSING" = "0" ] || die "Some libraries were not found (see MISSING above). Is the build complete?"
for b in "${BINS[@]}"; do
    # the program must find its own libs next to itself (RPATH $ORIGIN), not only through LD_LIBRARY_PATH
    if ! env -i "$b" --version >/dev/null 2>&1 && ! env -i "$b" --help >/dev/null 2>&1; then
        if command -v patchelf >/dev/null 2>&1; then patchelf --set-rpath '$ORIGIN' "$b" 2>/dev/null
        else echo "    note: $(basename "$b") did not start without LD_LIBRARY_PATH; install patchelf if the AppImage cannot find its libraries."; fi
    fi
done

step "appimagetool"
TOOL="${APPIMAGETOOL:-$(command -v appimagetool || true)}"
if [ -z "$TOOL" ]; then
    TOOL="$OUT/appimagetool-$ARCH.AppImage"
    if [ ! -x "$TOOL" ]; then
        echo "    downloading appimagetool ..."
        curl -fL --retry 3 -o "$TOOL" "https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-$ARCH.AppImage" \
            || die "Could not download appimagetool. Download it yourself, then:  APPIMAGETOOL=/path/to/appimagetool bash tools/build-appimage.sh"
        chmod +x "$TOOL"
    fi
fi

step "Packing"
VERSION="${KNOME_VERSION:-$(git -C "$ROOT" describe --tags --always 2>/dev/null || echo dev)}"
FILE="$OUT/Knome-$ARCH.AppImage"
rm -f "$FILE"
ARCH="$ARCH" VERSION="$VERSION" APPIMAGE_EXTRACT_AND_RUN=1 "$TOOL" --no-appstream "$APPDIR" "$FILE" || die "appimagetool failed."
chmod +x "$FILE"
printf '\n  Done:  %s  (%s)\n' "$FILE" "$(du -h "$FILE" | cut -f1)"
echo "  Run it:   $FILE"
echo "  First start asks for your models folder; later:  $FILE --models-folder | --image-folder | --settings"
