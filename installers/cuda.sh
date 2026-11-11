#!/usr/bin/env bash
# CUDA build: NVIDIA GPUs. Needs the CUDA toolkit (nvcc) -- the NVIDIA driver alone is not enough.
# Run through ./install.sh (or directly:  bash installers/cuda.sh)
BACKEND=cuda
BACKEND_DEPS='
CUDA toolkit (nvcc)@cuda@1@command -v nvcc || [ -x /usr/local/cuda/bin/nvcc ]@cuda-toolkit@cuda@nvidia-cuda-toolkit@
'
LLAMA_BACKEND_FLAGS=(-DGGML_CUDA=ON)
SD_BACKEND_FLAGS=(-DSD_CUDA=ON)

# nvcc often lives outside PATH
[ -d /usr/local/cuda/bin ] && export PATH="/usr/local/cuda/bin:$PATH"

backend_check() {
    command -v nvcc >/dev/null 2>&1 && return 0
    warn "CUDA toolkit (nvcc) not found."
    case "${DISTRO:-}" in
        fedora) info "Install it from NVIDIA's repo: https://developer.nvidia.com/cuda-downloads  (then run ./install.sh --backend cuda)" ;;
        arch)   info "sudo pacman -S cuda" ;;
        debian) info "sudo apt install nvidia-cuda-toolkit   (or the toolkit from https://developer.nvidia.com/cuda-downloads)" ;;
        *)      info "Install the CUDA toolkit from https://developer.nvidia.com/cuda-downloads" ;;
    esac
    info "No CUDA? ./install.sh --backend vulkan works on NVIDIA cards too."
}

. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
