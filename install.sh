#!/usr/bin/env bash
# ============================================================================
#  install.sh  --  one-time setup. Safe to run again: it only does what is missing.
#
#  It picks the right installer for your computer and runs it:
#      installers/vulkan.sh   AMD / Intel / NVIDIA GPUs through Vulkan  (works nearly everywhere)
#      installers/cuda.sh     NVIDIA GPUs with the CUDA toolkit
#      installers/rocm.sh     AMD GPUs with the ROCm SDK
#      installers/cpu.sh      no GPU
#  and asks a few settings first (context size, GPU layers, ...), see installers/settings.sh.
#  Each installer installs the missing dependencies, builds the web UI, llama.cpp (Knome),
#  stable-diffusion.cpp (image generation) and creates the Python tools environment.
#
#  Then start everything with ./Knome-start.sh
#
#  Options (all optional):
#    --backend vulkan|cuda|rocm|cpu   use this installer (default: automatic / what you used last time)
#    --choose-backend                 show a menu to pick the installer
#    --settings                       only ask the settings again (context size ...) and stop
#    --yes                            no questions: automatic backend, default settings
#    --no-image                       do not build image generation
#    --check                          only report what is installed / missing
#    --rebuild                        force a rebuild of everything
#    -h, --help                       this text
#
#  Environment:  KNOME_DRY_RUN=1  print the install commands instead of running them
# ============================================================================
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1
STATE_DIR="$SCRIPT_DIR/.knome-state"
mkdir -p "$STATE_DIR"

BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
info() { printf '    %s\n' "$1"; }
warn() { printf '%s !! %s%s\n' "$YELLOW" "$1" "$RESET"; }
good() { printf '%s    ✅ %s%s\n' "$GREEN" "$1" "$RESET"; }
die()  { printf '\n%s xx %s%s\n' "$RED" "$1" "$RESET" >&2; exit 1; }

BACKEND_ARG=""; MENU=0; SETTINGS_ONLY=0; ASSUME_YES=0; MODE_CHECK=0
PASS=()
while [ $# -gt 0 ]; do
    case "$1" in
        --backend)        BACKEND_ARG="${2:-}"; shift 2 || die "--backend needs a value (vulkan|cuda|rocm|cpu)" ;;
        --backend=*)      BACKEND_ARG="${1#*=}"; shift ;;
        --choose-backend) MENU=1; shift ;;
        --settings)       SETTINGS_ONLY=1; shift ;;
        --yes|-y)         ASSUME_YES=1; PASS+=("$1"); shift ;;
        --check)          MODE_CHECK=1; PASS+=("$1"); shift ;;
        -h|--help)        sed -n '2,29p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
        --no-image|--rebuild|--setup-only) PASS+=("$1"); shift ;;
        *)                die "Unknown option: $1  (try --help)" ;;
    esac
done

[ -d "$SCRIPT_DIR/llama.cpp" ] && [ -d "$SCRIPT_DIR/core-tools" ] && [ -d "$SCRIPT_DIR/installers" ] \
    || die "Run this from inside the Knome.mi folder (llama.cpp/, core-tools/ and installers/ must be next to it)."

printf '%sKnome%s  --  folder: %s\n' "$BOLD" "$RESET" "$SCRIPT_DIR"

INTERACTIVE=0
[ -t 0 ] && [ "$ASSUME_YES" = "0" ] && [ "$MODE_CHECK" = "0" ] && INTERACTIVE=1

gpu_vendors() {   # prints e.g. "nvidia amd intel"
    local out=""
    command -v lspci >/dev/null 2>&1 && out="$(lspci 2>/dev/null | grep -Ei 'vga|3d|display' | tr 'A-Z' 'a-z')"
    if [ -z "$out" ]; then
        local f
        for f in /sys/class/drm/card*/device/vendor; do
            [ -r "$f" ] && case "$(cat "$f")" in 0x10de) out="$out nvidia" ;; 0x1002) out="$out amd" ;; 0x8086) out="$out intel" ;; esac
        done
    fi
    case "$out" in *nvidia*) printf 'nvidia ' ;; esac
    case "$out" in *amd*|*radeon*|*ati*) printf 'amd ' ;; esac
    case "$out" in *intel*) printf 'intel ' ;; esac
}

auto_backend() {
    local v; v="$(gpu_vendors)"
    case " $v " in *" nvidia "*) { command -v nvcc >/dev/null 2>&1 || [ -x /usr/local/cuda/bin/nvcc ]; } && { echo cuda; return; } ;; esac
    case " $v " in *" amd "*)    { command -v hipcc >/dev/null 2>&1 || [ -x /opt/rocm/bin/hipcc ]; } && { echo rocm; return; } ;; esac
    { [ -n "$v" ] || [ -d /dev/dri ]; } && { echo vulkan; return; }
    echo cpu
}

BACKEND="${BACKEND_ARG:-${KNOME_BACKEND:-}}"
[ -z "$BACKEND" ] && [ "$MENU" = "0" ] && [ -f "$STATE_DIR/backend" ] && BACKEND="$(cat "$STATE_DIR/backend")"
if [ -z "$BACKEND" ]; then
    BACKEND="$(auto_backend)"
    if [ "$MENU" = "1" ] || { [ "$INTERACTIVE" = "1" ] && [ ! -f "$STATE_DIR/backend" ]; }; then
        [ "$INTERACTIVE" = "1" ] || die "--choose-backend needs a terminal."
        printf '\n%s==> Which installer?%s   detected GPU: %s\n' "$BOLD$GREEN" "$RESET" "$(gpu_vendors | sed 's/ $//')"
        i=1; DEF=1; OPTS=(vulkan cuda rocm cpu)
        LBL=("Vulkan - AMD / Intel / NVIDIA, works nearly everywhere" "CUDA   - NVIDIA, needs the CUDA toolkit" "ROCm   - AMD, needs the ROCm SDK" "CPU    - no GPU (slow)")
        for o in "${OPTS[@]}"; do
            [ "$o" = "$BACKEND" ] && DEF=$i
            printf '      %d) %s%s\n' "$i" "${LBL[$((i-1))]}" "$([ "$o" = "$BACKEND" ] && echo '   (recommended for this PC)')"
            i=$((i+1))
        done
        read -r -p "    Choose [1-4, Enter = $DEF]: " pick
        pick="${pick:-$DEF}"
        case "$pick" in 1|2|3|4) BACKEND="${OPTS[$((pick-1))]}" ;; esac
    fi
fi
case "$BACKEND" in
    vulkan|cuda|rocm|cpu) ;;
    *) die "Unknown backend '$BACKEND' (use vulkan, cuda, rocm or cpu)." ;;
esac
[ -f "$SCRIPT_DIR/installers/$BACKEND.sh" ] || die "installers/$BACKEND.sh is missing."

# settings: ask the first time, or when --settings is given; --yes / no terminal -> defaults
if [ "$MODE_CHECK" = "0" ] && { [ "$SETTINGS_ONLY" = "1" ] || [ ! -f "$STATE_DIR/settings.env" ]; }; then
    . "$SCRIPT_DIR/installers/settings.sh"
    ask_settings "$BACKEND"
fi
[ "$SETTINGS_ONLY" = "1" ] && { info "Done. The new settings apply the next time you start Knome (./Knome-start.sh)."; exit 0; }

exec bash "$SCRIPT_DIR/installers/$BACKEND.sh" ${PASS[@]+"${PASS[@]}"}
