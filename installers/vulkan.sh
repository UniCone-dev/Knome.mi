#!/usr/bin/env bash
# Vulkan build: works on AMD, Intel and NVIDIA GPUs with no vendor SDK. Best default for most PCs.
# Run through ./install.sh (or directly:  bash installers/vulkan.sh)
BACKEND=vulkan
BACKEND_DEPS='
Vulkan loader + headers@vulkan@1@pkg_exists vulkan@vulkan-loader-devel vulkan-headers@vulkan-icd-loader vulkan-headers@libvulkan-dev@vulkan-devel
glslc (shader compiler)@vulkan@1@command -v glslc@glslc@shaderc@glslc@shaderc
SPIR-V headers@vulkan@0@[ -f /usr/include/spirv/unified1/spirv.hpp ]@spirv-headers-devel@spirv-headers@spirv-headers@spirv-headers
SPIR-V tools@vulkan@0@[ -f /usr/include/spirv-tools/libspirv.h ] || pkg_exists SPIRV-Tools@spirv-tools-devel@spirv-tools@spirv-tools@spirv-tools-devel
glslang@vulkan@0@command -v glslang || command -v glslangValidator || [ -d /usr/include/glslang ]@glslang-devel@glslang@glslang-tools@glslang-devel
Vulkan GPU driver (AMD/Intel)@vulkan@0@have_vulkan_driver@mesa-vulkan-drivers@vulkan-radeon vulkan-intel@mesa-vulkan-drivers@libvulkan_radeon libvulkan_intel
'
LLAMA_BACKEND_FLAGS=(-DGGML_VULKAN=ON)
SD_BACKEND_FLAGS=(-DSD_VULKAN=ON)

have_vulkan_driver() {
    compgen -G "/usr/share/vulkan/icd.d/*.json" >/dev/null 2>&1 \
        || compgen -G "/etc/vulkan/icd.d/*.json" >/dev/null 2>&1 \
        || compgen -G "/usr/local/share/vulkan/icd.d/*.json" >/dev/null 2>&1
}

backend_check() {
    have_vulkan_driver && return 0
    warn "No Vulkan GPU driver detected -- Knome will fall back to the CPU."
    case "${DISTRO:-}" in
        fedora) info "For a GPU: sudo dnf install mesa-vulkan-drivers   (NVIDIA: install the NVIDIA driver)" ;;
        arch)   info "For a GPU: sudo pacman -S vulkan-radeon (AMD) or vulkan-intel (Intel), or the NVIDIA driver" ;;
        debian) info "For a GPU: sudo apt install mesa-vulkan-drivers   (NVIDIA: install the NVIDIA driver)" ;;
        suse)   info "For a GPU: sudo zypper install libvulkan_radeon libvulkan_intel   (NVIDIA: install the NVIDIA driver)" ;;
    esac
}

. "$(dirname "${BASH_SOURCE[0]}")/common.sh"
