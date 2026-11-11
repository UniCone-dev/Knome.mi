#!/usr/bin/env bash
# CPU-only build: no GPU needed (slower). Use it on PCs without a usable GPU.
# Run through ./install.sh (or directly:  bash installers/cpu.sh)
BACKEND=cpu
BACKEND_DEPS=''
LLAMA_BACKEND_FLAGS=()
SD_BACKEND_FLAGS=()

backend_check() {
    info "CPU build: no GPU libraries needed. Chat works, but big models and images will be slow."
}

. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
