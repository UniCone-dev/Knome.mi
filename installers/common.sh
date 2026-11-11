#!/usr/bin/env bash
# ============================================================================
#  installers/common.sh  --  the shared engine behind installers/{vulkan,cpu,cuda,rocm}.sh
#  (do not run this file directly; run ./install.sh)
#
#  A backend script sets, BEFORE sourcing this file:
#     BACKEND               vulkan | cpu | cuda | rocm
#     BACKEND_DEPS          extra dependency rows for that backend (same format as DEPS_TABLE below)
#     LLAMA_BACKEND_FLAGS   cmake flags for llama.cpp
#     SD_BACKEND_FLAGS      cmake flags for stable-diffusion.cpp
#     backend_check()       (optional) runs after the dependency step; prints hints for that backend
# ============================================================================
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -uo pipefail
: "${BACKEND:?installers/common.sh must be started through a backend script (see ./install.sh)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR" || exit 1

LLAMA_DIR="$SCRIPT_DIR/llama.cpp"
UI_DIR="$LLAMA_DIR/tools/ui"
BUILD_DIR="$LLAMA_DIR/build"
STATE_DIR="$SCRIPT_DIR/.knome-state"
VENV_DIR="$SCRIPT_DIR/core-tools/venv"
MODELS_DIR="$SCRIPT_DIR/models"
mkdir -p "$STATE_DIR"

# ---------------------------------------------------------------- output ---
BOLD=$'\033[1m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; RESET=$'\033[0m'
step() { printf '\n%s==> %s%s\n' "$BOLD$GREEN" "$1" "$RESET"; }
info() { printf '    %s\n' "$1"; }
good() { printf '%s    ✅ %s%s\n' "$GREEN" "$1" "$RESET"; }
warn() { printf '%s !! %s%s\n' "$YELLOW" "$1" "$RESET"; }
bad()  { printf '%s    ❌ %s%s\n' "$RED" "$1" "$RESET"; }
die()  { printf '\n%s xx %s%s\n' "$RED" "$1" "$RESET" >&2; exit 1; }


# ------------------------------------------------------------------ args ---
MODE_CHECK=0
FORCE_REBUILD=0
NO_IMAGE=0
ASSUME_YES=0

while [ $# -gt 0 ]; do
    case "$1" in
        --check)       MODE_CHECK=1; shift ;;
        --setup-only|--choose-backend|--settings) shift ;;
        --backend)     shift 2 || true ;;
        --backend=*)   shift ;;
        --no-image)    NO_IMAGE=1; shift ;;
        --yes|-y)      ASSUME_YES=1; shift ;;
        --rebuild)     FORCE_REBUILD=1; shift ;;
        *)             die "Unknown option: $1  (try ./install.sh --help)" ;;
    esac
done

# ---------------------------------------------------------------- sanity ---
if [ ! -d "$LLAMA_DIR" ] || [ ! -d "$SCRIPT_DIR/core-tools" ]; then
    die "Run this from inside the Knome.mi folder (llama.cpp/ and core-tools/ were not found next to it)."
fi


# ---------------------------------------------------------------- distro ---
RHEL_LIKE=0
detect_distro() {
    local ids=""
    if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        ids=" $(. /etc/os-release; echo "${ID:-} ${ID_LIKE:-}") "
    fi
    case "$ids" in
        *" rhel "*|*" centos "*|*" rocky "*|*" almalinux "*|*" ol "*|*" scientific "*) RHEL_LIKE=1 ;;
    esac
    case "$ids" in
        *" arch "*|*" manjaro "*|*" endeavouros "*|*" cachyos "*|*" garuda "*|*" artix "*) echo arch; return ;;
        *" opensuse"*|*" suse "*|*" sles "*|*" sled "*) echo suse; return ;;
        *" fedora "*|*" rhel "*|*" centos "*|*" rocky "*|*" almalinux "*|*" ol "*|*" nobara "*|*" bazzite "*|*" amzn "*) echo fedora; return ;;
        *" debian "*|*" ubuntu "*|*" linuxmint "*|*" pop "*|*" zorin "*|*" elementary "*|*" kali "*|*" raspbian "*|*" neon "*|*" mx "*|*" devuan "*) echo debian; return ;;
    esac
    # unknown os-release: fall back to whichever package manager exists
    if command -v pacman  >/dev/null 2>&1; then echo arch;   return; fi
    if command -v zypper  >/dev/null 2>&1; then echo suse;   return; fi
    if command -v dnf     >/dev/null 2>&1 || command -v yum >/dev/null 2>&1; then echo fedora; return; fi
    if command -v apt-get >/dev/null 2>&1; then echo debian; return; fi
    echo unknown
}

step "Detecting your system"
DISTRO="$(detect_distro)"
case "$DISTRO" in
    fedora) [ "$RHEL_LIKE" = "1" ] && info "Distro family: RHEL / Rocky / Alma / CentOS (dnf)" || info "Distro family: Fedora (dnf)" ;;
    arch)   info "Distro family: Arch (pacman)" ;;
    suse)   info "Distro family: openSUSE / SLES (zypper)" ;;
    debian) info "Distro family: Debian / Ubuntu (apt)" ;;
    *)      warn "Unknown distro: dependencies are checked and listed, but you must install missing ones yourself (docs/INSTALL.md has the list)." ;;
esac


# --------------------------------------------------------------- backend ---
info "Build: $BACKEND"

# ----------------------------------------------------------- dependencies ---
pkg_exists() { command -v pkg-config >/dev/null 2>&1 && pkg-config --exists "$@" 2>/dev/null; }

# Node 20.19+ / 22.12+ is what the UI toolchain (vite 7) needs.
node_ok() {
    command -v node >/dev/null 2>&1 || return 1
    node -e '
        const [maj, min] = process.versions.node.split(".").map(Number);
        process.exit(maj >= 23 || (maj === 22 && min >= 12) || (maj === 20 && min >= 19) ? 0 : 1);
    ' 2>/dev/null
}

# name @ group @ required @ check (bash) @ fedora/rhel pkgs @ arch pkgs @ debian/ubuntu pkgs @ opensuse pkgs
# (fields are split on '@' so the checks can contain '||')
# Rows for the chosen backend come from BACKEND_DEPS (set by installers/<backend>.sh).
# required=0 rows are installed when possible but never block the build.
DEPS_TABLE='
GCC (C compiler)@core@1@command -v gcc@gcc@gcc@gcc@gcc
G++ (C++ compiler)@core@1@command -v g++@gcc-c++@gcc@g++@gcc-c++
make@core@1@command -v make@make@make@make@make
CMake@core@1@command -v cmake@cmake@cmake@cmake@cmake
Git@core@1@command -v git@git@git@git@git
pkg-config@core@1@command -v pkg-config || command -v pkgconf@pkgconf-pkg-config@pkgconf@pkg-config@pkg-config
curl@core@1@command -v curl@curl@curl@curl@curl
OpenSSL (dev files)@core@0@pkg_exists openssl@openssl-devel@openssl@libssl-dev@libopenssl-devel
Python 3@core@1@command -v python3@python3@python@python3@python3
pip@core@1@python3 -m pip --version@python3-pip@python-pip@python3-pip@python3-pip
Python venv module@core@1@python3 -c "import venv, ensurepip"@python3@python@python3-venv@python3-pip
Node.js (20.19+ / 22)@core@1@node_ok@nodejs22@nodejs@nodejs@nodejs22
npm@core@1@command -v npm@nodejs22-npm@npm@npm@npm22
'

# Reads the table into parallel arrays (only rows that apply to this backend).
DEP_NAME=(); DEP_REQ=(); DEP_CHECK=(); DEP_PKGS=()
load_deps() {
    DEP_NAME=(); DEP_REQ=(); DEP_CHECK=(); DEP_PKGS=()
    local name group req check fed arch deb sus pkgs
    while IFS='@' read -r name group req check fed arch deb sus; do
        [ -z "$name" ] && continue
        case "$DISTRO" in
            fedora) pkgs="$fed" ;;
            arch)   pkgs="$arch" ;;
            debian) pkgs="$deb" ;;
            suse)   pkgs="$sus" ;;
            *)      pkgs="" ;;
        esac
        DEP_NAME+=("$name"); DEP_REQ+=("$req"); DEP_CHECK+=("$check"); DEP_PKGS+=("$pkgs")
    done <<< "$DEPS_TABLE"$'\n'"${BACKEND_DEPS:-}"
}

dep_ok() { eval "${DEP_CHECK[$1]}" >/dev/null 2>&1; }

report_deps() {
    local i missing_required=0
    for i in "${!DEP_NAME[@]}"; do
        if dep_ok "$i"; then
            good "${DEP_NAME[$i]}"
        elif [ "${DEP_REQ[$i]}" = "1" ]; then
            bad "${DEP_NAME[$i]}  (missing)"; missing_required=1
        else
            warn "${DEP_NAME[$i]}  (optional, missing)"
        fi
    done
    return "$missing_required"
}

run_root() {
    if [ "${KNOME_DRY_RUN:-0}" = "1" ]; then
        printf '    [dry-run] %s\n' "$*"
        return 0
    fi
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    elif command -v sudo >/dev/null 2>&1; then
        sudo "$@"
    else
        warn "sudo is not available -- run this script as root, or install the packages yourself:"
        printf '    %s\n' "$*"
        return 1
    fi
}

pm_install() {
    case "$DISTRO" in
        fedora) run_root dnf install -y "$@" ;;
        arch)   run_root pacman -S --needed --noconfirm "$@" ;;
        debian) run_root apt-get install -y "$@" ;;
        suse)   run_root zypper --non-interactive install --no-recommends "$@" ;;
        *)      return 1 ;;
    esac
}

# Installs a package list; if the all-at-once call fails (one unknown package
# name on some release), falls back to one-by-one so the rest still install.
install_packages() {
    local pkgs=("$@") p failed=()
    [ ${#pkgs[@]} -eq 0 ] && return 0

    if [ "$DISTRO" = "debian" ]; then run_root apt-get update -y || true; fi
    if [ "$DISTRO" = "suse" ]; then run_root zypper --non-interactive refresh || true; fi
    if [ "$DISTRO" = "fedora" ] && [ "$RHEL_LIKE" = "1" ]; then
        # RHEL-family: extra repos hold glslc / spirv / glslang
        run_root dnf install -y epel-release >/dev/null 2>&1 || true
        run_root dnf config-manager --set-enabled crb >/dev/null 2>&1 || run_root dnf config-manager --set-enabled powertools >/dev/null 2>&1 || true
    fi

    pm_install "${pkgs[@]}" && return 0

    warn "Bulk install failed -- retrying package by package."
    for p in "${pkgs[@]}"; do
        pm_install "$p" || failed+=("$p")
    done
    if [ ${#failed[@]} -gt 0 ]; then
        warn "Could not install: ${failed[*]}"
        return 1
    fi
    return 0
}

# Node needs special care: distro repos sometimes ship a version too old for the UI build.
fix_node() {
    node_ok && command -v npm >/dev/null 2>&1 && return 0

    case "$DISTRO" in
        fedora)
            info "Trying Node.js 22 from the distro, then from NodeSource..."
            run_root dnf module enable -y nodejs:22 >/dev/null 2>&1 || true
            pm_install nodejs npm || true
            if ! node_ok && command -v curl >/dev/null 2>&1; then
                if [ "$(id -u)" -eq 0 ]; then curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && dnf install -y nodejs
                else curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo -E bash - && sudo dnf install -y nodejs; fi
            fi ;;
        suse)
            info "Trying Node.js 22 from the distro..."
            pm_install nodejs22 npm22 || pm_install nodejs npm || true ;;
        arch) pm_install nodejs npm || true ;;
        debian)
            info "The distro's Node.js is too old (or missing). Installing Node 22 from NodeSource..."
            if command -v curl >/dev/null 2>&1; then
                if [ "${KNOME_DRY_RUN:-0}" = "1" ]; then
                    info "[dry-run] curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -; apt-get install -y nodejs"
                elif [ "$(id -u)" -eq 0 ]; then
                    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
                else
                    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
                fi
            fi ;;
    esac
}

step "Checking dependencies"
load_deps

MISSING_PKGS=()
MISSING_COUNT=0
for i in "${!DEP_NAME[@]}"; do
    if ! dep_ok "$i"; then
        MISSING_COUNT=$((MISSING_COUNT + 1))
        for p in ${DEP_PKGS[$i]}; do
            case " ${MISSING_PKGS[*]:-} " in *" $p "*) ;; *) MISSING_PKGS+=("$p") ;; esac
        done
    fi
done

if [ "$MODE_CHECK" = "1" ]; then
    report_deps; rc=$?
    declare -F backend_check >/dev/null && backend_check
    [ -d "$VENV_DIR" ] && info "core-tools venv: present" || info "core-tools venv: not created yet"
    [ -x "$BUILD_DIR/bin/llama-server" ] && info "llama-server: built" || info "llama-server: not built yet"
    [ -f "$UI_DIR/dist/index.html" ] && info "web UI: built" || info "web UI: not built yet"
    exit "$rc"
fi

if [ "$MISSING_COUNT" -eq 0 ]; then
    good "Everything needed is already installed -- nothing to install."
else
    info "Missing: ${MISSING_PKGS[*]:-(see list below)}"
    if [ "$DISTRO" = "unknown" ]; then
        warn "Unknown distro -- please install the missing items above yourself, then run this again."
    else
        info "Installing only those (you may be asked for your sudo password)..."
        install_packages "${MISSING_PKGS[@]}" || true
        fix_node
    fi
fi

# Re-check after installing and show the checklist.
echo
report_deps
if [ $? -ne 0 ]; then
    if [ "${KNOME_DRY_RUN:-0}" = "1" ]; then
        info "(dry-run: stopping here, nothing was installed)"; exit 0
    fi
    die "Some required tools are still missing (see the ❌ lines above). Install them and run ./install.sh again."
fi

declare -F backend_check >/dev/null && backend_check

[ "${KNOME_DRY_RUN:-0}" = "1" ] && { info "(dry-run finished)"; exit 0; }

# ---------------------------------------------------------- memory sizing ---
MEM_MB="$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 4096)"
NPROC="$(nproc 2>/dev/null || echo 2)"

# Node's default heap (~2 GB) is too small for the UI build -- that caused
# "JavaScript heap out of memory". Give it ~70% of RAM, between 3 and 8 GB.
NODE_HEAP=$(( MEM_MB * 70 / 100 ))
[ "$NODE_HEAP" -gt 8192 ] && NODE_HEAP=8192
[ "$NODE_HEAP" -lt 3072 ] && NODE_HEAP=3072

# C++ compile jobs: roughly 1.5 GB of RAM per job so low-RAM PCs don't freeze.
JOBS=$(( MEM_MB / 1500 ))
[ "$JOBS" -lt 1 ] && JOBS=1
[ "$JOBS" -gt "$NPROC" ] && JOBS="$NPROC"

# ----------------------------------------------------------------- web UI ---
UI_REBUILT=0
ui_needs_build() {
    [ "$FORCE_REBUILD" = "1" ] && return 0
    [ -f "$UI_DIR/dist/index.html" ] || return 0
    [ -n "$(find "$UI_DIR/src" "$UI_DIR/static" "$UI_DIR/package.json" -newer "$UI_DIR/dist/index.html" -print -quit 2>/dev/null)" ]
}

step "Web UI"
if ui_needs_build; then
    info "Building the UI (first time takes a minute or two)..."
    (
        cd "$UI_DIR" || exit 1
        if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
            npm install --no-audit --no-fund || exit 1
        fi
        NODE_OPTIONS="--max-old-space-size=$NODE_HEAP" npm run build
    ) || die "Web UI build failed. (Low RAM? close other apps and run ./install.sh --rebuild again.)"
    UI_REBUILT=1
    good "UI built."
else
    good "UI is up to date."
fi

# -------------------------------------------------------------- llama.cpp ---
step "llama.cpp ($BACKEND)"

# A build/ folder configured in another location (e.g. you moved or renamed
# this folder) breaks CMake: "CMakeCache.txt directory is different". Detect
# that and start clean.
if [ -f "$BUILD_DIR/CMakeCache.txt" ]; then
    CACHED_HOME="$(grep -m1 '^CMAKE_HOME_DIRECTORY' "$BUILD_DIR/CMakeCache.txt" 2>/dev/null | cut -d= -f2-)"
    if [ -n "$CACHED_HOME" ] && [ "$(readlink -f "$CACHED_HOME" 2>/dev/null)" != "$(readlink -f "$LLAMA_DIR")" ]; then
        warn "Old build cache belongs to another folder -- removing it."
        rm -rf "$BUILD_DIR"
    fi
fi

SAVED_BACKEND=""
[ -f "$STATE_DIR/backend" ] && SAVED_BACKEND="$(cat "$STATE_DIR/backend")"
if [ -d "$BUILD_DIR" ] && [ -n "$SAVED_BACKEND" ] && [ "$SAVED_BACKEND" != "$BACKEND" ]; then
    warn "Backend changed ($SAVED_BACKEND -> $BACKEND) -- rebuilding from scratch."
    rm -rf "$BUILD_DIR"
fi
[ "$FORCE_REBUILD" = "1" ] && rm -rf "$BUILD_DIR"

LLAMA_BIN="$BUILD_DIR/bin/llama-server"

if [ ! -x "$LLAMA_BIN" ] || [ "$UI_REBUILT" = "1" ]; then
    CMAKE_FLAGS=(-DCMAKE_BUILD_TYPE=Release "${LLAMA_BACKEND_FLAGS[@]}")

    info "Compiling (first time can take 5-15 minutes; using $JOBS parallel jobs)..."
    ( cmake -S "$LLAMA_DIR" -B "$BUILD_DIR" "${CMAKE_FLAGS[@]}" \
        && cmake --build "$BUILD_DIR" --target llama-server --config Release -j"$JOBS" ) \
        || die "llama.cpp build failed -- see the messages above. Fix them and run ./install.sh again."
    good "llama-server built."
else
    good "llama-server is already built."
fi
echo "$BACKEND" > "$STATE_DIR/backend"

# ------------------------------------------------- image generation (optional) ---
# stable-diffusion.cpp comes bundled in Knome.mi/stable-diffusion.cpp. If it is missing it is
# downloaded. A failure here is never fatal: text chat works without it.
SD_DIR="$SCRIPT_DIR/stable-diffusion.cpp"
SD_BUILD="$SD_DIR/build"
SD_REPO="https://github.com/leejet/stable-diffusion.cpp"
if [ "$NO_IMAGE" = "0" ]; then
    step "Image generation (stable-diffusion.cpp)"
    if [ ! -f "$SD_DIR/CMakeLists.txt" ]; then
        # normally it comes bundled with Knome; if the folder is missing, download it
        info "stable-diffusion.cpp is not in $SD_DIR - downloading it (git clone)..."
        rm -rf "$SD_DIR" 2>/dev/null
        if git clone --recursive "$SD_REPO" "$SD_DIR"; then
            good "Downloaded."
        else
            warn "Download failed (internet?). Image generation is skipped; run ./install.sh again later."
        fi
    fi
fi

if [ "$NO_IMAGE" = "0" ] && [ -f "$SD_DIR/CMakeLists.txt" ]; then
    SD_SAVED=""; [ -f "$STATE_DIR/sd-backend" ] && SD_SAVED="$(cat "$STATE_DIR/sd-backend")"
    if [ -d "$SD_BUILD" ] && { [ "$SD_SAVED" != "$BACKEND" ] || [ "$FORCE_REBUILD" = "1" ]; }; then
        warn "Rebuilding the image server (build type changed or --rebuild)."
        rm -rf "$SD_BUILD"
    fi
    if [ -f "$SD_BUILD/CMakeCache.txt" ]; then
        SD_CACHED="$(grep -m1 '^CMAKE_HOME_DIRECTORY' "$SD_BUILD/CMakeCache.txt" 2>/dev/null | cut -d= -f2-)"
        if [ -n "$SD_CACHED" ] && [ "$(readlink -f "$SD_CACHED" 2>/dev/null)" != "$(readlink -f "$SD_DIR")" ]; then
            rm -rf "$SD_BUILD"
        fi
    fi
    if [ ! -x "$SD_BUILD/bin/sd-server" ]; then
        SD_FLAGS=(-DCMAKE_BUILD_TYPE=Release -DSD_SERVER_BUILD_FRONTEND=OFF "${SD_BACKEND_FLAGS[@]}")
        info "Compiling sd-server (first time takes several minutes; $JOBS parallel jobs)..."
        if cmake -S "$SD_DIR" -B "$SD_BUILD" "${SD_FLAGS[@]}" \
            && cmake --build "$SD_BUILD" --target sd-server --config Release -j"$JOBS"; then
            echo "$BACKEND" > "$STATE_DIR/sd-backend"
            good "sd-server built."
        else
            warn "sd-server build failed."
            SD_OK=0
            # a git clone whose ggml submodule does not match the sources gives "multiple definition" errors
            if [ -d "$SD_DIR/.git" ] && command -v git >/dev/null 2>&1; then
                info "Syncing the stable-diffusion.cpp submodules and trying once more..."
                git -C "$SD_DIR" submodule update --init --recursive || true
                rm -rf "$SD_BUILD"
                if cmake -S "$SD_DIR" -B "$SD_BUILD" "${SD_FLAGS[@]}" \
                    && cmake --build "$SD_BUILD" --target sd-server --config Release -j"$JOBS"; then SD_OK=1; fi
            fi
            # last resort: the copy bundled with Knome
            if [ "$SD_OK" = "0" ] && [ -f "$SCRIPT_DIR/.knome-state/stable-diffusion.cpp.tar.xz" ]; then
                info "Using the stable-diffusion.cpp copy bundled with Knome instead..."
                mv "$SD_DIR" "$SD_DIR.broken-$(date +%s)"
                mkdir -p "$SD_DIR" && tar -xJf "$SCRIPT_DIR/.knome-state/stable-diffusion.cpp.tar.xz" -C "$SD_DIR"
                if cmake -S "$SD_DIR" -B "$SD_BUILD" "${SD_FLAGS[@]}" \
                    && cmake --build "$SD_BUILD" --target sd-server --config Release -j"$JOBS"; then SD_OK=1; fi
            fi
            if [ "$SD_OK" = "1" ]; then
                echo "$BACKEND" > "$STATE_DIR/sd-backend"; good "sd-server built."
            else
                warn "Image generation will be unavailable (text chat is fine). Fix the error above, then run ./install.sh again."
            fi
        fi
    else
        good "sd-server is already built."
    fi
fi
mkdir -p "$SCRIPT_DIR/image-models"

# ----------------------------------------------------------- python tools ---
step "Built-in tools (memory, web search)"

VENV_PY="$VENV_DIR/bin/python3"
TOOLS_IMPORT='import mcp, ddgs, httpx, bs4, wikipedia'

if [ -x "$VENV_PY" ] && "$VENV_PY" -c "$TOOLS_IMPORT" >/dev/null 2>&1; then
    good "Tools environment is ready."
else
    # A venv copied from another folder/PC has dead paths inside -- start fresh.
    if [ -d "$VENV_DIR" ] && { [ ! -x "$VENV_PY" ] || ! "$VENV_PY" -c 'import sys' >/dev/null 2>&1; }; then
        warn "Old tools environment is broken -- recreating it."
        rm -rf "$VENV_DIR"
    fi
    info "Setting up the tools environment..."
    (
        cd "$SCRIPT_DIR/core-tools" || exit 1
        [ -d venv ] || python3 -m venv venv
        ./venv/bin/python3 -m pip install --upgrade pip -q
        ./venv/bin/python3 -m pip install -q "mcp>=2,<3" ddgs httpx beautifulsoup4 wikipedia
    ) || die "Could not set up the tools environment (check your internet connection)."
    good "Tools environment ready."
fi
mkdir -p "$SCRIPT_DIR/memory" "$SCRIPT_DIR/slots" "$MODELS_DIR"

# ------------------------------------------------------------ shortcuts ---
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true
if [ ! -f "$STATE_DIR/shortcuts-done" ] && [ -x "$SCRIPT_DIR/install-shortcuts.sh" ]; then
    "$SCRIPT_DIR/install-shortcuts.sh" >/dev/null 2>&1 \
        && info "Terminal shortcuts added (open a new terminal, then just type: knome)" \
        && touch "$STATE_DIR/shortcuts-done"
fi

# ------------------------------------------------------------ folder layout ---
# Creates the folders (and a short README in each) where your models go. Only creates what is missing.
mkdir -p "$MODELS_DIR" "$SCRIPT_DIR/image-models"
[ -f "$MODELS_DIR/README.txt" ] || cat > "$MODELS_DIR/README.txt" <<'EOT'
TEXT MODELS go here (.gguf).

Simplest: one file per model
    models/Qwen3-4B-Instruct-Q8_0.gguf

Vision model (it can look at pictures): the model + its mmproj file
  either in a folder of its own (recommended)
    models/gemma-4-E4B/gemma-4-E4B-it-Q8_0.gguf
    models/gemma-4-E4B/mmproj-F16.gguf
  or flat: a single  mmproj-*.gguf  next to one model is attached to it automatically.
  (Change it any time: Models window > Vision.)

Image models do NOT go here, they go in ../image-models/
EOT
for d in diffusion_models checkpoints text_encoders vae loras controlnet clip_vision recipes; do
    mkdir -p "$SCRIPT_DIR/image-models/$d"
done
[ -f "$SCRIPT_DIR/image-models/README.txt" ] || cat > "$SCRIPT_DIR/image-models/README.txt" <<'EOT'
IMAGE / VIDEO MODELS go here. Put each file loose anywhere in this folder (Knome sorts them by name),
or into the matching folder yourself:

  diffusion_models/   the main model     e.g. qwen-image-2.1-turbo-Q6_K_XL.gguf, z-image-turbo-Q6_K.gguf, flux1-dev-Q4.gguf
  checkpoints/        all-in-one models  e.g. sd15.safetensors, sdxl_base.safetensors
  text_encoders/      text encoder + vision projector  e.g. Qwen3-VL-8B-Instruct-Q5_K_M.gguf, mmproj-F16.gguf, t5xxl.safetensors
                      (your text models in ../models are offered here automatically - no copy needed)
  vae/                the VAE            e.g. ae.safetensors, qwen_image_2.1_vae_bf16.safetensors
  loras/  controlnet/  clip_vision/      optional extras
  recipes/            your own model recipes (.json) for models Knome does not know yet

Which parts a model needs: look at the model's page (Hugging Face). Knome picks the matching ones itself:
Models window > "Image & video models" shows what it found. Added files appear within seconds
(press Re-detect).
EOT

# ------------------------------------------------------------------- done ---
echo "$BACKEND" > "$STATE_DIR/backend"
date +%s > "$STATE_DIR/setup-done"

step "Setup finished"
good "Build: $BACKEND"
[ -x "$BUILD_DIR/bin/llama-server" ] && good "Knome (llama-server) ready"
[ -x "$SD_BUILD/bin/sd-server" ] && good "Image generation (sd-server) ready" || info "Image generation: not set up (optional)"
info "Text models go in:   $MODELS_DIR/"
info "Image models go in:  $SCRIPT_DIR/image-models/   (VAE / text encoders too)"
info "Start everything with:  ./Knome-start.sh"
