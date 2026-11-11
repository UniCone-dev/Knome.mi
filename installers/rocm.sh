#!/usr/bin/env bash
# ROCm / HIP build: AMD GPUs supported by ROCm. Needs the ROCm SDK (hipcc).
# Most AMD cards (also RX 7600 etc.) work great with the Vulkan build too: ./install.sh --backend vulkan
# Run through ./install.sh (or directly:  bash installers/rocm.sh)
BACKEND=rocm
BACKEND_DEPS='
ROCm / HIP SDK (hipcc)@rocm@1@command -v hipcc || [ -x /opt/rocm/bin/hipcc ]@rocm-hip-sdk@rocm-hip-sdk@rocm-hip-sdk hipcc@
'
LLAMA_BACKEND_FLAGS=(-DGGML_HIP=ON)
SD_BACKEND_FLAGS=(-DSD_HIPBLAS=ON)

[ -d /opt/rocm/bin ] && export PATH="/opt/rocm/bin:$PATH"
# point cmake at ROCm's clang when the SDK is present
if command -v hipconfig >/dev/null 2>&1; then
    export HIPCXX="$(hipconfig -l 2>/dev/null)/clang"
    export HIP_PATH="$(hipconfig -R 2>/dev/null)"
fi
# build only for the GPU in this PC (faster, smaller)
if command -v rocminfo >/dev/null 2>&1; then
    _gfx="$(rocminfo 2>/dev/null | grep -o -m1 'gfx[0-9a-f]*' | head -1)"
    if [ -n "$_gfx" ]; then LLAMA_BACKEND_FLAGS+=("-DGPU_TARGETS=$_gfx"); SD_BACKEND_FLAGS+=("-DGPU_TARGETS=$_gfx"); fi
fi

backend_check() {
    command -v hipcc >/dev/null 2>&1 && return 0
    warn "ROCm / HIP SDK (hipcc) not found."
    case "${DISTRO:-}" in
        arch)   info "sudo pacman -S rocm-hip-sdk" ;;
        debian) info "Install ROCm from https://rocm.docs.amd.com/  (package: rocm-hip-sdk)" ;;
        *)      info "Install ROCm from https://rocm.docs.amd.com/" ;;
    esac
    info "No ROCm? ./install.sh --backend vulkan works on AMD cards too."
}

. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
