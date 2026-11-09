# Knome

Your own private AI at home: chat, tools, memory, characters and image generation - all on your computer, no cloud.

- **Chat** with local GGUF models (llama.cpp), with vision, reasoning, tools (memory, web search, Wikipedia, Python) and a modern web UI.
- **Images and video** with stable-diffusion.cpp. Your text model is swapped out for the image model and back again automatically.
- **Characters / Messenger mode / DeepMind mode**, scheduled messages, library of your files, full backups.
- **Experience modes**: Clean & Minimal, Pro, or Free (everything).

## Quick start

```bash
cd Knome.mi
./Knome-start.sh    # first time: sets everything up by itself (no questions), then starts Knome + the image server
```

1. Text models (`.gguf`, and `mmproj-*.gguf` for vision) go in `models/`.
2. Image models and their parts (diffusion model, text encoder, VAE ...) go in `image-models/` - all loose, in any order.
3. Open the browser: Knome finds your image model by itself (Models window > Image & video), and **+ > Create image** works.

stable-diffusion.cpp comes bundled in `stable-diffusion.cpp/`. `./install.sh` can also be run alone (setup only).

Supported systems: Debian, Ubuntu (+ Mint, Pop!_OS ...), Fedora, RHEL / Rocky / Alma / CentOS, Arch (+ Manjaro, EndeavourOS ...), openSUSE / SLES.
Other Linux: works too, see the manual list in docs/INSTALL.md.

## Folders

```
Knome.mi/
├── models/                 text models (.gguf) + mmproj files
├── image-models/           image/video models and their parts (VAE, text encoders) - loose files are fine
│   └── diffusion_models/ checkpoints/ text_encoders/ vae/ loras/ controlnet/ clip_vision/ recipes/  (created for you)
├── llama.cpp/              Knome's server and web UI
├── stable-diffusion.cpp/   image generation (bundled)
├── core-tools/             built-in tools (memory, web search ...)
├── memory/  slots/  characters/   your data (auto-created)
├── install.sh              one-time setup: picks the best build itself, installs + builds everything
├── Knome-start.sh          daily command: sets up if needed, then starts everything
├── start-knome.sh          the launcher itself (called by Knome-start.sh)
└── docs/                   INSTALL.md  FEATURES.md  IMAGE.md
```

## Documentation

- [docs/index.html](docs/index.html) - the friendly illustrated guide (open it in a browser)
- [docs/INSTALL.md](docs/INSTALL.md) - automatic install, manual install, builds (Vulkan / CPU / CUDA / ROCm), updating, troubleshooting
- [docs/FEATURES.md](docs/FEATURES.md) - everything Knome can do and where the switches are
- [docs/IMAGE.md](docs/IMAGE.md) - image and video generation, the smart workload swap, editing pictures
- [docs/PUBLISHING.md](docs/PUBLISHING.md) - how to publish this on GitHub
- [VISION.md](VISION.md) - vision models and the Vision Bridge

## Credits

Knome was made by **UniCone-dev** and **Rudr Pal** together, built side by side with **Claude** (Anthropic) as the coding partner.

- GitHub: [UniCone-dev](https://github.com/UniCone-dev)
- YouTube: [@RudrINDIA](https://www.youtube.com/@RudrINDIA)

Built on [llama.cpp](https://github.com/ggml-org/llama.cpp) and [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) - thank you to everyone behind them.

## Licence

MIT - see [LICENSE](LICENSE) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Models are not included and have their own licences.
Before publishing your own copy run `./tools/check-before-publish.sh`.
