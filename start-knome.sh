#!/usr/bin/env bash
# Starts Knome: the model AND its built-in tools (memory, web search, etc)
# together, in one process tree. No separate "mcp" command, no ports for
# tools, no CORS -- llama-server spawns core-tools/server.py itself over
# stdio.
#
# Model detection, mirroring llama-server's own --models-dir convention:
#   models/
#     my-text-model.gguf              <- single-file model
#     my-vision-model/
#       my-vision-model.gguf          <- any name, just not starting "mmproj"
#       mmproj-f16.gguf               <- must start with "mmproj"
#
# - Exactly one model unit found -> single-model mode (unchanged from before).
# - More than one -> router mode: llama-server loads models on demand, and
#   the Web UI lets you pick which one is active per chat. This is what
#   powers "Vision Bridge": keep a text model as your default and drop a
#   vision model in its own subfolder (with its mmproj file) and the text
#   model can call it as a tool to "look" at images for you -- see
#   VISION.md for details.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODELS_DIR="$SCRIPT_DIR/models"
UNIT_NAMES=()
UNIT_PATHS=()
UNIT_IS_VISION=()

for entry in "$MODELS_DIR"/*; do
    [ -e "$entry" ] || continue
    base="$(basename "$entry")"

    if [ -f "$entry" ] && [[ "$entry" == *.gguf ]] && [[ "${base,,}" != mmproj* ]]; then
        UNIT_NAMES+=("${base%.gguf}")
        UNIT_PATHS+=("$entry")
        UNIT_IS_VISION+=("0")
    elif [ -d "$entry" ]; then
        has_model=0
        has_mmproj=0
        for f in "$entry"/*.gguf; do
            [ -e "$f" ] || continue
            fbase="$(basename "$f")"
            if [[ "${fbase,,}" == mmproj* ]]; then
                has_mmproj=1
            else
                has_model=1
            fi
        done
        # --- FIX APPLIED HERE ---
        # A directory is now counted as a model unit if it has a regular model OR if it has the mmproj file.
        if [ "$has_model" -eq 1 ] || [ "$has_mmproj" -eq 1 ]; then
            UNIT_NAMES+=("$base")
            UNIT_PATHS+=("$entry")
            UNIT_IS_VISION+=("$has_mmproj")
        fi
    fi
done

if [ ${#UNIT_NAMES[@]} -eq 0 ]; then
    echo "Error: No .gguf model found in $MODELS_DIR/"
    echo "Add your .gguf file there: $MODELS_DIR/"
    exit 1
fi

# Settings chosen during install (./install.sh --settings changes them any time):
#   KNOME_CTX   auto | 4096 | 8192 | 16384 | 32768 | 65536 | 131072     (auto = fit to the free GPU memory)
#   KNOME_NGL   auto | all | <number of layers on the GPU>
#   KNOME_KV    q4_0 | q8_0 | f16                                       (KV-cache precision; q4_0 uses least memory)
#   KNOME_PORT  8080
# Environment variables still win:  LLM_CTX=8192 LLM_NGL=20 LLM_PORT=8081 ./start-knome.sh
[ -f "$SCRIPT_DIR/.knome-state/settings.env" ] && . "$SCRIPT_DIR/.knome-state/settings.env"
NGL="${LLM_NGL:-${KNOME_NGL:-auto}}"
CTX="${LLM_CTX:-${KNOME_CTX:-auto}}"
KV="${KNOME_KV:-q4_0}"
PORT="${LLM_PORT:-${KNOME_PORT:-8080}}"

if [ ! -x "$SCRIPT_DIR/llama.cpp/build/bin/llama-server" ]; then
    echo "Error: llama-server binary not found/built at $SCRIPT_DIR/llama.cpp/build/bin/llama-server"
    echo "Build llama.cpp first (run ./install.sh)."
    exit 1
fi

# Re-run cmake build every launch: this re-embeds tools/ui/dist into the
# binary if it changed (e.g. after editing the UI + npm run build) without
# you having to remember a separate rebuild step. Incremental, so it's fast
# (a couple seconds) when nothing actually changed.
echo "Checking for UI/source changes to rebuild..."
BUILD_LOG="$(mktemp)"
if cmake --build "$SCRIPT_DIR/llama.cpp/build" --target llama-server -j"$(nproc)" > "$BUILD_LOG" 2>&1; then
    rm -f "$BUILD_LOG"
else
    echo "Warning: rebuild failed -- continuing with the existing binary. Build log:"
    cat "$BUILD_LOG"
    rm -f "$BUILD_LOG"
fi

CORE_TOOLS_VENV="$SCRIPT_DIR/core-tools/venv/bin/python3"
if [ ! -x "$CORE_TOOLS_VENV" ]; then
    echo "Error: core-tools venv not found at $CORE_TOOLS_VENV"
    echo "Run: ./install.sh (this creates the venv automatically)."
    exit 1
fi

mkdir -p "$SCRIPT_DIR/memory" "$SCRIPT_DIR/slots"

# For core-tools' clear_context tool: it needs a model name to target in
# router mode (single-model mode ignores this). Pick the first non-vision
# unit as "the" text model; if everything found is a vision unit (unusual),
# fall back to the first unit found.
TEXT_MODEL_NAME=""
VISION_MODEL_NAME=""
for i in "${!UNIT_NAMES[@]}"; do
    if [ "${UNIT_IS_VISION[$i]}" -eq 1 ] && [ -z "$VISION_MODEL_NAME" ]; then
        VISION_MODEL_NAME="${UNIT_NAMES[$i]}"
        echo "  -> Identified Vision Model: $VISION_MODEL_NAME"
    elif [ "${UNIT_IS_VISION[$i]}" -eq 0 ] && [ -z "$TEXT_MODEL_NAME" ]; then
        TEXT_MODEL_NAME="${UNIT_NAMES[$i]}"
        echo "  -> Identified Text Model (Default): $TEXT_MODEL_NAME"
    fi
done

echo -e "\n--- Knome Model Summary ---"
echo "Total Models Detected: ${#UNIT_NAMES[@]}"
echo "Text Model (Default): ${TEXT_MODEL_NAME:-None}"
echo "Vision Model(s) Available: ${VISION_MODEL_NAME:-None}"
echo "--------------------------\n"


# Built-in tools, spawned directly by llama-server over stdio (Cursor-compatible
# mcpServers JSON format). No port, no network, no CORS involved at all.
MCP_SERVERS_JSON=$(cat <<JSON
{
  "mcpServers": {
    "knome-core": {
      "command": "$CORE_TOOLS_VENV",
      "args": ["$SCRIPT_DIR/core-tools/server.py"],
      "cwd": "$SCRIPT_DIR/core-tools",
      "env": {
        "KNOME_ROOT": "$SCRIPT_DIR",
        "LLAMA_SERVER_URL": "http://127.0.0.1:$PORT",
        "TEXT_MODEL_NAME": "$TEXT_MODEL_NAME"
      }
    }
  }
}
JSON
)

# --- Image / video generation (optional) --------------------------------------------------
# Folder layout (all inside Knome.mi/):
#   stable-diffusion.cpp/   the stable-diffusion.cpp source (Knome-start.sh builds sd-server from it)
#   image-models/           image models + their parts. Drop files in loose OR in category folders
#                           (diffusion_models, checkpoints, vae, text_encoders, loras, controlnet).
#   models/                 your text models. They are ALSO offered to the image server as text
#                           encoders (e.g. Qwen3-4B for Z-Image), nothing is copied.
# Loose files in image-models/ are sorted by name into a private view (.knome-state/sd-models) with
# symlinks - your files are never moved. Override: SD_SERVER_PATH, SD_PORT, SD_ARGS="--offload-to-cpu"
sd_category() {   # prints the sd-server category for a file name
    local n="${1,,}"
    case "$n" in
        *mmproj*)                                         echo text_encoders ;;
        *lora*)                                           echo loras ;;
        *controlnet*|*control_*|*control-*)               echo controlnet ;;
        *vae*|ae.safetensors|ae.sft|ae.gguf|*taesd*|*taef*|*tae_*) echo vae ;;
        *t5*|*clip_*|*clip-*|*umt5*|*qwen*vl*|*qwen3*|*qwen2*|*llm*|*gemma*|*text_enc*|*mistral*) echo text_encoders ;;
        *sd15*|*sd-1*|*sd_1*|*v1-5*|*sdxl*|*sd_xl*|*sd3*|*sd-3*|*checkpoint*|*dreamshaper*|*realvis*|*juggernaut*|*pony*) echo checkpoints ;;
        *)                                                echo diffusion_models ;;
    esac
}

SD_BIN="${SD_SERVER_PATH:-}"
if [ -z "$SD_BIN" ]; then
    for cand in "$SCRIPT_DIR/stable-diffusion.cpp/build/bin/sd-server" "$SCRIPT_DIR/image/sd-server" "$SCRIPT_DIR/sd-server"; do
        [ -x "$cand" ] && SD_BIN="$cand" && break
    done
fi
if [ -n "$SD_BIN" ] && [ -x "$SD_BIN" ]; then
    SD_PORT="${SD_PORT:-1234}"
    IMG_DIR="$SCRIPT_DIR/image-models"
    SD_VIEW="$SCRIPT_DIR/.knome-state/sd-models"
    mkdir -p "$IMG_DIR"
    # The image server only accepts real files that live inside its model folder (symlinks pointing
    # outside are refused), so the view uses HARD LINKS: same file on disk, no copy, no extra space.
    # (Hard links need the same disk; if that is not possible a normal link is used and a note is printed.)
    sd_link() {   # sd_link <file> <category>
        local f="$1" cat="$2" dst
        dst="$SD_VIEW/$cat/$(basename "$f")"
        [ -e "$dst" ] && return 0
        mkdir -p "$SD_VIEW/$cat"
        ln "$f" "$dst" 2>/dev/null || { ln -s "$f" "$dst"; SD_LINK_WARN=1; }
    }
    sync_sd_view() {
        local f rel cat
        while IFS= read -r f; do
            rel="${f#"$IMG_DIR"/}"
            case "$rel" in
                recipes/*) continue ;;
                */*) cat="${rel%%/*}"; case "$cat" in diffusion_models|checkpoints|vae|vae_approx|text_encoders|clip_vision|loras|controlnet|ipadapter|tokenizers|motion_modules|photomaker|pulid|upscale_models|embeddings) ;; *) cat="$(sd_category "$(basename "$f")")" ;; esac ;;
                *)   cat="$(sd_category "$rel")" ;;
            esac
            sd_link "$f" "$cat"
        done < <(find "$IMG_DIR" -type f \( -iname '*.safetensors' -o -iname '*.gguf' -o -iname '*.ckpt' -o -iname '*.sft' -o -iname '*.pth' -o -iname '*.pt' -o -iname '*.bin' \) 2>/dev/null)
        # your text models are valid text encoders too (and mmproj files for vision encoders)
        while IFS= read -r f; do sd_link "$f" text_encoders; done < <(find "$MODELS_DIR" -maxdepth 2 -type f -iname '*.gguf' 2>/dev/null)
        # your own recipes (image-models/recipes/*.json)
        if compgen -G "$IMG_DIR/recipes/*.json" >/dev/null 2>&1; then
            mkdir -p "$SD_VIEW/recipes"; cp -f "$IMG_DIR"/recipes/*.json "$SD_VIEW/recipes/" 2>/dev/null
        fi
        # drop links whose source is gone
        find "$SD_VIEW" -xtype l -delete 2>/dev/null
    }
    rm -rf "$SD_VIEW"; mkdir -p "$SD_VIEW"
    SD_LINK_WARN=0
    sync_sd_view
    [ "$SD_LINK_WARN" = "1" ] && echo "  Note: image-models/ and models/ are on different disks, so the image server may not see some files. Keep them inside Knome.mi/ on one disk."
    echo "Starting image server on port $SD_PORT ..."
    # shellcheck disable=SC2086
    # Low-memory defaults (memory-mapped weights, tiled VAE). Replace with SD_ARGS="..." if you want.
    SD_ARGS="${SD_ARGS---mmap --vae-tiling}"
    # The image server is supervised: if it ever dies (e.g. the system ran out of memory) it comes back
    # by itself, so "Cannot reach the image server" fixes itself after a few seconds.
    : > "$SCRIPT_DIR/image-server.log" 2>/dev/null || true
    (
        while true; do
            # shellcheck disable=SC2086
            "$SD_BIN" --model-dir "$SD_VIEW" --listen-ip 127.0.0.1 --listen-port "$SD_PORT" ${SD_ARGS:-} \
                >> "$SCRIPT_DIR/image-server.log" 2>&1
            echo "[knome] image server exited (code $?), restarting in 3 s" >> "$SCRIPT_DIR/image-server.log"
            sleep 3
        done
    ) &
    SD_PID=$!
    trap 'pkill -P "$SD_PID" 2>/dev/null; kill "$SD_PID" 2>/dev/null' EXIT
    # pick up files you add later (the UI "Re-detect" button then finds them)
    ( while kill -0 "$SD_PID" 2>/dev/null; do sleep 6; sync_sd_view; done ) &
    ( for _ in $(seq 1 60); do
          if curl -fsS "http://127.0.0.1:$SD_PORT/sdcpp/v1/model-files" >/dev/null 2>&1; then
              echo "  Image server ready:  http://127.0.0.1:$SD_PORT"; exit 0
          fi
          sleep 1
      done ) &
else
    echo "(Image generation: sd-server not built - skipped. Put stable-diffusion.cpp/ next to llama.cpp/ and run ./Knome-start.sh)"
fi

cd "$SCRIPT_DIR/llama.cpp" || exit 1

BOLD=$'\033[1m'; GREEN=$'\033[32m'; DIM=$'\033[2m'; RESET=$'\033[0m'
printf '\n%s  K N O M E%s   your local AI - text, tools, memory and images\n' "$BOLD$GREEN" "$RESET"
printf '%s  Chat:%s            http://127.0.0.1:%s\n' "$BOLD" "$RESET" "$PORT"
if [ -n "${SD_PID:-}" ]; then
    printf '%s  Image server:%s   http://127.0.0.1:%s   (turn on in Settings > Profile > Image & video)\n' "$BOLD" "$RESET" "${SD_PORT:-1234}"
fi
printf '%s  Text models:%s     %s\n' "$BOLD" "$RESET" "$MODELS_DIR"
printf '%s  Image models:%s    %s\n' "$BOLD" "$RESET" "$SCRIPT_DIR/image-models"
printf '%s  Stop:%s            Ctrl+C\n\n' "$DIM" "$RESET"

echo "Knome is starting, please wait..."
[ "${KNOME_NO_BROWSER:-0}" = "1" ] || ( sleep 3 && xdg-open "http://127.0.0.1:$PORT" >/dev/null 2>&1 & )

# "auto" = leave the option out, so llama.cpp fits layers / context into the free memory by itself
# (an explicit -c 131072 -ngl 999 cannot be fitted and fails to load on small GPUs).
COMMON_ARGS=()
case "$NGL" in auto|"") ;; all) COMMON_ARGS+=(-ngl 999) ;; *) COMMON_ARGS+=(-ngl "$NGL") ;; esac
case "$CTX" in auto|"") ;; *) COMMON_ARGS+=(-c "$CTX") ;; esac
COMMON_ARGS+=(
    --cache-type-k "$KV" --cache-type-v "$KV"
    --host 127.0.0.1 --port "$PORT"
    --tools all --jinja
    -ag
    --slot-save-path "$SCRIPT_DIR/slots"
    --mcp-servers-json "$MCP_SERVERS_JSON"
)

# Router mode is always used now, even for one model, so the Models window (load / unload,
# vision file) works out of the box: just drop models (and their mmproj files) in models/.
# Set KNOME_SINGLE_MODEL=1 to get the old single-model server for exactly one model.
if [ "${KNOME_SINGLE_MODEL:-0}" = "1" ] && [ ${#UNIT_NAMES[@]} -eq 1 ]; then
    # Single model -- the old behavior, single-model server, no router.
    if [ -f "${UNIT_PATHS[0]}" ]; then
        MODEL_FILE="${UNIT_PATHS[0]}"
    else
        MODEL_FILE=$(find "${UNIT_PATHS[0]}" -maxdepth 1 -iname "*.gguf" ! -iname "mmproj*" | head -1)
    fi
    echo "Using model: ${UNIT_NAMES[0]}"

    ./build/bin/llama-server \
        -m "$MODEL_FILE" \
        --parallel 1 \
        "${COMMON_ARGS[@]}"
else
    # Multiple models -- router mode. llama-server loads each on demand;
    # pick the active one from the model dropdown in the Web UI. A vision
    # subfolder (with its mmproj file) becomes callable by a text model via
    # the "Vision Bridge" tool -- see VISION.md.
    echo "Starting in router mode with ${#UNIT_NAMES[@]} model(s):"
    for name in "${UNIT_NAMES[@]}"; do
        echo "  - $name"
    done

    ./build/bin/llama-server \
        --models-dir "$MODELS_DIR" \
        --parallel 1 \
        "${COMMON_ARGS[@]}"
fi

