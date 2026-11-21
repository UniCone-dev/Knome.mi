# Knome as an AppImage

One file, double-click to run. Your data stays **outside** the file, so updating Knome never touches your chats, memory, characters or models.

## Build it (on your own computer)

```bash
./install.sh                      # once: builds llama-server (+ sd-server)
bash tools/build-appimage.sh      # -> build-appimage/Knome-x86_64.AppImage
```

Needs internet once (downloads `appimagetool`). Build on the **oldest** Linux you want to support: an AppImage runs on the same glibc or newer.
Use the same backend you want to ship (Vulkan build -> Vulkan AppImage). The GPU driver / Vulkan always comes from the user's system.

## Run it

```bash
chmod +x Knome-x86_64.AppImage
./Knome-x86_64.AppImage
```

First start: it asks **"Select your models folder"** (any folder, any disk) and, optionally, the image models folder. It then sets up the Python tools once (needs `python3`, `python3-venv` and internet), and opens http://127.0.0.1:8080.

| Command | What it does |
|---|---|
| `--models-folder` | choose the text models folder |
| `--image-folder` | choose the image models folder |
| `--settings` | context size, GPU layers, port, system control |
| `--no-browser` | do not open the browser |
| `--data-dir` | print where your data lives |

Environment: `KNOME_DATA_DIR`, `KNOME_MODELS_DIR`, `KNOME_IMAGE_MODELS_DIR`, `LLM_PORT`, `LLM_CTX`, `LLM_NGL`.

## Where things live

| What | Where |
|---|---|
| program | inside the AppImage (read-only) |
| memory, characters, slots, settings, logs, python tools | `~/.local/share/Knome/` |
| text models | the folder you picked (default `~/.local/share/Knome/models`) |
| image models | the folder you picked (default `~/.local/share/Knome/image-models`) |

The same folder choice works in a normal install too: `./Knome-start.sh --models-folder` / `--image-folder` (also asked in `./install.sh --settings`).

## Image models on another disk

The image server only accepts real files inside its own folder. Knome therefore keeps a small "view" (`.knome-view`) **inside your image-models folder** made of hard links (no copy, no extra space). If your text models are on a different disk than the image models, those cannot be hard-linked; Knome falls back to normal links and prints a note. Fix: put the text encoder file straight into the image-models folder.

## Good to know

- Not bundled: GPU drivers, Vulkan, Python. Bundled: llama-server (web UI inside), sd-server, the tools, and the non-system libraries they need.
- Moving to another distro: build on the oldest one you support, or ship a separate build per backend (Vulkan / CUDA / CPU).
- To remove everything Knome stored: delete `~/.local/share/Knome/`.
