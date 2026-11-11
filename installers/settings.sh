#!/usr/bin/env bash
# installers/settings.sh -- asks the build-time settings and saves them to .knome-state/settings.env
# (sourced by ./install.sh; ./Knome-start.sh --settings or ./install.sh --settings asks again any time)
#   KNOME_CTX   auto | 4096 | 8192 | 16384 | 32768 | 65536 | 131072   how much text the AI remembers per chat
#   KNOME_NGL   auto | all | <n>       how many model layers go to the GPU
#   KNOME_PORT  8080                   web address http://127.0.0.1:PORT

vram_mb() {   # best-effort GPU memory in MB, empty when unknown
    local f v best=0
    for f in /sys/class/drm/card*/device/mem_info_vram_total; do
        [ -r "$f" ] || continue
        v=$(( $(cat "$f") / 1048576 )); [ "$v" -gt "$best" ] && best="$v"
    done
    if [ "$best" = "0" ] && command -v nvidia-smi >/dev/null 2>&1; then
        v="$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | sort -nr | head -1)"
        [ -n "$v" ] && best="$v"
    fi
    [ "$best" -gt 0 ] && echo "$best"
}

# choose "question" default_index "label1" "label2" ...   -> sets CHOICE (1-based index)
choose() {
    local q="$1" def="$2"; shift 2
    local i=1 a
    echo; echo "    $q"
    for a in "$@"; do
        printf '      %d) %s%s\n' "$i" "$a" "$([ "$i" = "$def" ] && echo '   (default)')"
        i=$((i + 1))
    done
    read -r -p "    Choose [1-$#, Enter = $def]: " CHOICE
    CHOICE="${CHOICE:-$def}"
    case "$CHOICE" in ''|*[!0-9]*) CHOICE="$def" ;; esac
    { [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "$#" ]; } && CHOICE="$def"
    return 0
}

ask_settings() {   # ask_settings <backend>
    local backend="$1" file="$STATE_DIR/settings.env"
    local ctx=auto ngl=auto port=8080 vram hint=""
    # keep earlier answers as defaults
    [ -f "$file" ] && . "$file" && ctx="${KNOME_CTX:-auto}" ngl="${KNOME_NGL:-auto}" port="${KNOME_PORT:-8080}"

    if [ "${INTERACTIVE:-0}" = "1" ]; then
        printf '\n%s==> Settings%s   %s(press Enter to accept the recommended answer; change later with ./install.sh --settings)%s\n' "$BOLD$GREEN" "$RESET" "$DIM" "$RESET"
        vram="$(vram_mb)"
        if [ -n "$vram" ]; then
            hint="detected GPU memory: ~$(( (vram + 512) / 1024 )) GB"
            echo "    $hint"
        fi
        choose "Context size = how much text the AI can keep in mind in one chat. Bigger needs more memory." 1 \
            "Auto - fits your free GPU/RAM memory (recommended)" "8K  (4 GB GPU or less)" "16K" "32K  (8 GB GPU)" "64K  (12-16 GB GPU)" "128K  (24 GB GPU or more)" "I will type a number"
        case "$CHOICE" in
            1) ctx=auto ;; 2) ctx=8192 ;; 3) ctx=16384 ;; 4) ctx=32768 ;; 5) ctx=65536 ;; 6) ctx=131072 ;;
            7) read -r -p "    Context tokens (e.g. 24576): " ctx; case "$ctx" in ''|*[!0-9]*) ctx=auto ;; esac ;;
        esac
        info "(change it any time:  ./Knome-start.sh --settings )"

        if [ "$backend" != "cpu" ]; then
            choose "How many model layers go to the GPU?" 1 \
                "Auto - as many as fit (recommended)" "All of them (fails to load if the model does not fit)" "None - run on the CPU" "I will type a number"
            case "$CHOICE" in
                1) ngl=auto ;; 2) ngl=all ;; 3) ngl=0 ;;
                4) read -r -p "    GPU layers (e.g. 20): " ngl; case "$ngl" in ''|*[!0-9]*) ngl=auto ;; esac ;;
            esac
        else
            ngl=0
        fi

        read -r -p "    Web port [$port]: " _p
        case "${_p:-$port}" in ''|*[!0-9]*) ;; *) port="${_p:-$port}" ;; esac
    else
        [ "$backend" = "cpu" ] && ngl=0
    fi

    cat > "$file" <<EOT
# Knome settings. Change with ./install.sh --settings  (or edit this file).
KNOME_CTX=$ctx
KNOME_NGL=$ngl
KNOME_PORT=$port
EOT
    good "Settings saved: context=$ctx, GPU layers=$ngl, port=$port"
}
