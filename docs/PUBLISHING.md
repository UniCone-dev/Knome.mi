# Publishing Knome on GitHub

## 1. Before you publish (checklist)

1. `./tools/check-before-publish.sh` must say **All clear**.
2. `.gitignore` is in place (it keeps `models/`, `image-models/`, `memory/`, `slots/`, `.knome-state/`, `*.log` out). After `git add`, run `git status` and look for anything big or personal.
3. No file over **100 MB** (GitHub refuses it). Models never go in the repo.
4. Open `docs/index.html` once and check the text and credits.
5. Make sure no password, token or API key is in any file: `grep -rniE "api[_-]?key|token|secret|password" --exclude-dir=node_modules --exclude-dir=llama.cpp . | head`
6. Test on a clean copy: clone the repo into a new folder and run `./Knome-start.sh` (this proves a stranger can install it).
7. Each model has its own licence - say so (it is already in THIRD-PARTY-NOTICES.md).

## 2. Create the repository

On github.com (account UniCone-dev): **New repository**, name `Knome.mi` (or `Knome`), Public, **do not** tick "Add README / .gitignore / licence" (you already have them).

```bash
cd Knome.mi
git init -b main
git add -A
git status                      # read it once
git commit -m "Knome: local AI with chat, tools, memory, characters and image generation"
git remote add origin https://github.com/UniCone-dev/Knome.mi.git
git push -u origin main
```

If git asks for a login use a Personal Access Token (GitHub > Settings > Developer settings > Tokens) or `gh auth login`.

## 3. Make the repository look good

- **About** box (top right): description "Private local AI: chat, tools, memory, characters and image generation (llama.cpp + stable-diffusion.cpp)", topics `llama-cpp` `stable-diffusion` `local-ai` `gguf` `self-hosted` `svelte` `linux`, website = your docs page.
- **Screenshots**: put 3-4 pictures in `docs/shots/` and show them at the top of README.md (`![](docs/shots/05-result.png)`).
- **Releases**: Releases > Draft a new release > tag `v0.1.0`, short notes.
- **Docs page** (optional): Settings > Pages > Source: `main`, folder `/docs` - then `docs/index.html` becomes a website.
- Add an Issues template later if people start reporting bugs.

## 4. Size and upstream code

The repo contains a full copy of llama.cpp and stable-diffusion.cpp. That is fine (both MIT), but it is large (hundreds of MB with history). Two options:
- **Keep as is** (simplest, works offline, what you have now).
- **Smaller repo**: keep only your changes and fetch upstream in `install.sh`. This is a bigger change - ask before doing it.

Keep the original LICENSE files inside `llama.cpp/` and `stable-diffusion.cpp/` (they are already there).
