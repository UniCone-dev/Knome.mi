# Image / video generation in Knome

Folders inside Knome.mi/ :
  stable-diffusion.cpp/   bundled with Knome (built by install.sh)
  image-models/           image models AND their parts (VAE like ae.safetensors, text encoders ...).
                          Loose files are fine: start-knome.sh sorts them by name. Category folders also work.
  models/                 your text models. They are also offered to the image server as text encoders
                          (e.g. Qwen3-4B for Z-Image) - nothing is copied or moved.

Steps
1. Put the files in image-models/ (loose, any order) and run ./Knome-start.sh (the first run builds sd-server, 5-15 min).
2. Nothing to switch on: Knome finds the image server and your files, picks the model type from the file names and fills
   all parts (text encoder, vision projector, VAE). See Models window > Image & video models. Change anything in
   Settings > Profile > Image & video if you want.
3. In chat: + > Create image (an **Image** chip appears next to Think and an options bar above the message box: model, aspect, size, quality, steps - all "Auto (AI)" unless you set them), or just ask. Say things like "16:9, high quality, 40 steps, seed 7, no text" -
   the AI sets size, steps, cfg, sampler, seed and negative prompt for that picture.
4. Attach a picture and ask for a change = edit. Edit models (qwen-image-edit, flux kontext ...) get it as a reference,
   other models use it as the img2img start picture (the AI can set "strength").
Env: SD_SERVER_PATH, SD_PORT, SD_ARGS. Default SD_ARGS is "--mmap --vae-tiling" (low memory); the image server is supervised and restarts by itself if it stops.
The AI picks sizes inside what the chosen model draws well (SD1.5 up to 768 px, SDXL ~1536, Flux/Qwen/Z-Image up to 2048).

## How the swap works
1. The image server (sd-server) is checked first. If it is not running nothing else happens.
2. Your loaded text model(s) are remembered and unloaded.
3. The image model and its parts are loaded, the picture is made, the image model is unloaded.
4. Your text model(s) are loaded again - also when something failed or you pressed Cancel.
5. The picture appears in the chat (optionally with a short "Image ready" note).

## Update stable-diffusion.cpp
`git clone --recursive https://github.com/leejet/stable-diffusion.cpp stable-diffusion.cpp` (replace the folder), then `./Knome-start.sh --rebuild`.

## Using your own stable-diffusion.cpp
`stable-diffusion.cpp/` is a plain, untouched copy of upstream - Knome never edits it. Everything Knome adds lives outside it
(the model view built by `start-knome.sh`, your recipes in `image-models/recipes/`, the UI). So you can replace it any time:

```bash
cd Knome.mi
rm -rf stable-diffusion.cpp
git clone --recursive https://github.com/leejet/stable-diffusion.cpp stable-diffusion.cpp
./Knome-start.sh        # notices there is no sd-server yet, builds it, starts everything
```

## How Knome connects to it
- `start-knome.sh` builds `.knome-state/sd-models/` : hard links (same files, no copies, no extra disk space) of everything in
  `image-models/` sorted into the folders the image server expects, plus your text models as text encoders.
  Hard links are needed because the image server refuses symbolic links that point outside its model folder
  ("path escapes model directory"). Keep `models/` and `image-models/` on the same disk.
- The view is refreshed every few seconds, so a file you add shows up after Re-detect (Models window).
- The UI talks to the server on port 1234 (`/sdcpp/v1/...`): lists model types and files, loads one, generates, unloads.
