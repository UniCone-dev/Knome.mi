#!/usr/bin/env bash
# installers/paths.sh -- where your models live. Sourced by start-knome.sh, Knome-start.sh, install settings and the AppImage.
#   KNOME_MODELS_DIR         text models (.gguf)        default: <data>/models
#   KNOME_IMAGE_MODELS_DIR   image models               default: <data>/image-models
# Saved in <data>/.knome-state/paths.env . An environment variable always wins over the saved file.

knome_load_paths() {   # knome_load_paths <data dir>
    local f="$1/.knome-state/paths.env" k v
    [ -f "$f" ] || return 0
    while IFS='=' read -r k v; do
        case "$k" in
            KNOME_MODELS_DIR|KNOME_IMAGE_MODELS_DIR)
                v="${v%\"}"; v="${v#\"}"
                [ -n "$v" ] && [ -z "${!k:-}" ] && export "$k=$v" ;;
        esac
    done < "$f"
    return 0
}

knome_save_path() {   # knome_save_path <data dir> <KEY> <value>   (empty value = back to the default)
    local d="$1" k="$2" v="$3" f
    f="$d/.knome-state/paths.env"
    mkdir -p "$d/.knome-state"
    { [ -f "$f" ] && grep -v "^$k=" "$f"; [ -n "$v" ] && printf '%s="%s"\n' "$k" "$v"; } > "$f.tmp" 2>/dev/null
    mv -f "$f.tmp" "$f"
}

knome_pick_folder() {   # knome_pick_folder <title> <start folder>  -> prints the folder (nothing if cancelled)
    local title="$1" start="${2:-$HOME}" out=""
    [ -d "$start" ] || start="$HOME"
    if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
        if command -v kdialog >/dev/null 2>&1; then
            out="$(kdialog --title "$title" --getexistingdirectory "$start" 2>/dev/null)"
        elif command -v zenity >/dev/null 2>&1; then
            out="$(zenity --file-selection --directory --title="$title" --filename="$start/" 2>/dev/null)"
        fi
        [ -n "$out" ] && { printf '%s\n' "${out%/}"; return 0; }
        # a dialog was shown and cancelled -> nothing; no dialog tool -> fall through to the terminal
        if command -v kdialog >/dev/null 2>&1 || command -v zenity >/dev/null 2>&1; then return 0; fi
    fi
    if [ -t 0 ]; then
        read -r -e -p "    $title (Enter = keep $start): " -i "" out
        out="${out/#\~/$HOME}"
        [ -n "$out" ] && { printf '%s\n' "${out%/}"; return 0; }
    fi
    return 0
}

# knome_choose_folders <data dir> [models|image|both]   asks (folder dialog or terminal) and saves
knome_choose_folders() {
    local d="$1" what="${2:-both}" cur p
    knome_load_paths "$d"
    if [ "$what" = models ] || [ "$what" = both ]; then
        cur="${KNOME_MODELS_DIR:-$d/models}"
        echo "    Text models folder (your .gguf files; a vision model goes in its own sub-folder with its mmproj file)"
        p="$(knome_pick_folder "Select your TEXT models folder" "$cur")"
        if [ -n "$p" ]; then mkdir -p "$p" 2>/dev/null; knome_save_path "$d" KNOME_MODELS_DIR "$p"; KNOME_MODELS_DIR="$p"; export KNOME_MODELS_DIR; echo "    -> text models: $p"; else echo "    -> text models: $cur (unchanged)"; fi
    fi
    if [ "$what" = image ] || [ "$what" = both ]; then
        cur="${KNOME_IMAGE_MODELS_DIR:-$d/image-models}"
        echo "    Image models folder (diffusion models, VAE, text encoders, LoRAs ...)"
        p="$(knome_pick_folder "Select your IMAGE models folder" "$cur")"
        if [ -n "$p" ]; then mkdir -p "$p" 2>/dev/null; knome_save_path "$d" KNOME_IMAGE_MODELS_DIR "$p"; KNOME_IMAGE_MODELS_DIR="$p"; export KNOME_IMAGE_MODELS_DIR; echo "    -> image models: $p"; else echo "    -> image models: $cur (unchanged)"; fi
    fi
    return 0
}
