# Installing Knome

## Automatic (recommended)

```bash
cd Knome.mi
./Knome-start.sh        # sets up on the first run, then starts everything
```

`./install.sh` is the setup part alone. It asks nothing:

- **Your Linux** is detected: Debian / Ubuntu family (apt), Fedora and RHEL / Rocky / Alma / CentOS (dnf, EPEL and CRB are enabled for you), Arch family (pacman), openSUSE / SLES (zypper).
- **The build** is chosen for your computer: CUDA if an NVIDIA GPU and the CUDA toolkit are present, ROCm if an AMD GPU and ROCm are present, otherwise **Vulkan** (AMD, Intel and NVIDIA - this is what most people get), or CPU when there is no GPU.
  Force one with `./install.sh --backend vulkan|cpu|cuda|rocm` (CUDA/ROCm toolkits are installed by you; they are huge and vendor-specific).
- **Dependencies**: only missing ones are installed - compilers, cmake, git, Python, Node.js 20.19+/22, Vulkan headers, shader compiler, Mesa Vulkan drivers (AMD/Intel). Your NVIDIA driver is yours to install.
- **Builds**: web UI, llama.cpp (Knome), stable-diffusion.cpp (image generation, bundled; downloaded if the folder is missing), Python tools environment.

Options: `--backend X`, `--no-image`, `--check` (only report), `--rebuild`.
`./Knome-start.sh` runs the setup again by itself when something is missing or the UI changed (for example after a patch).

Other Linux (Gentoo, Void, Alpine, NixOS ...): `./install.sh` lists what is missing; install it with your package manager (names in the table below) and run it again.

## Manual install

1. **Dependencies**
   - Fedora: `sudo dnf install gcc gcc-c++ make cmake git pkgconf-pkg-config curl openssl-devel python3 python3-pip nodejs22 nodejs22-npm vulkan-loader-devel vulkan-headers glslc spirv-headers-devel spirv-tools-devel glslang-devel`
   - Arch: `sudo pacman -S --needed gcc make cmake git pkgconf curl openssl python python-pip nodejs npm vulkan-icd-loader vulkan-headers shaderc spirv-headers spirv-tools glslang`
   - Ubuntu/Debian: `sudo apt install build-essential cmake git pkg-config curl libssl-dev python3 python3-pip python3-venv nodejs npm libvulkan-dev glslc spirv-headers spirv-tools glslang-tools`
   - Node must be 20.19+ or 22.12+ (on Debian/Ubuntu use NodeSource if the distro one is older).
   - Skip the Vulkan lines for CPU / CUDA / ROCm builds.
2. **Web UI**
   ```bash
   cd llama.cpp/tools/ui && npm install && NODE_OPTIONS=--max-old-space-size=4096 npm run build && cd ../../..
   ```
3. **llama.cpp** (pick one backend flag: `-DGGML_VULKAN=ON`, `-DGGML_CUDA=ON`, `-DGGML_HIP=ON`, or none for CPU)
   ```bash
   cmake -S llama.cpp -B llama.cpp/build -DCMAKE_BUILD_TYPE=Release -DGGML_VULKAN=ON
   cmake --build llama.cpp/build --target llama-server --config Release -j$(nproc)
   ```
4. **Tools environment**
   ```bash
   cd core-tools && python3 -m venv venv && ./venv/bin/pip install "mcp>=2,<3" ddgs httpx beautifulsoup4 wikipedia && cd ..
   ```
5. **Image generation (optional)**
   ```bash
   git clone --recursive https://github.com/leejet/stable-diffusion.cpp stable-diffusion.cpp
   cmake -S stable-diffusion.cpp -B stable-diffusion.cpp/build -DCMAKE_BUILD_TYPE=Release -DSD_SERVER_BUILD_FRONTEND=OFF -DSD_VULKAN=ON   # or -DSD_CUDA=ON / -DSD_HIPBLAS=ON
   cmake --build stable-diffusion.cpp/build --target sd-server --config Release -j$(nproc)
   ```
6. **Folders and start**
   ```bash
   mkdir -p models image-models memory slots
   mkdir -p .knome-state && date +%s > .knome-state/setup-done     # tells Knome-start.sh that setup is done
   ./start-knome.sh
   ```

## Updating / patches

Apply a patch with `bash apply.sh /path/to/Knome.mi`, then run `./Knome-start.sh` (it rebuilds the UI).
Change build type later: `./install.sh --choose-backend`.

## Troubleshooting

- *UI build: "JavaScript heap out of memory"* - close other programs and run `./install.sh --rebuild`.
- *No GPU used* - for Vulkan install a Vulkan driver (`mesa-vulkan-drivers`, `vulkan-radeon`, `vulkan-intel` or the NVIDIA driver). Check with `vulkaninfo --summary`.
- *Image server not starting* - read `image-server.log`.
- *Image server runs but "0 files found"* - files must be inside Knome.mi/image-models/ (any order) and on the same disk as Knome.mi; check `image-server.log`.
- *A model shows "Failed to load"* - image models do not belong in `models/`; put them in `image-models/`.
