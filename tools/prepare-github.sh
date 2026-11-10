#!/usr/bin/env bash
# Prepares this folder for GitHub so that a fresh clone is IDENTICAL to your working folder:
#  - ready-made folders (models/, image-models/ + sub-folders, memory/, slots/, characters/) with README files
#  - a .gitignore that hides ONLY your private data and build output (always from the repo root, never source code)
#  - a report of everything that is still being ignored, so nothing important is left out silently
# Usage:  bash tools/prepare-github.sh        (then: git commit -m "..." && git push)
cd "$(dirname "$0")/.." || exit 1
command -v git >/dev/null || { echo "git is not installed"; exit 1; }
[ -d .git ] || git init -b main >/dev/null

# ---------------------------------------------------------------- .gitignore ---
cat > .gitignore <<'EOF'
# ===== your private data: ignored ONLY at the repo root (the folders stay, with a README) =====
/models/*
!/models/README.txt
!/models/.gitkeep
/image-models/*
!/image-models/README.txt
!/image-models/*/
/image-models/*/*
!/image-models/*/.gitkeep
/memory/*
!/memory/.gitkeep
/slots/*
!/slots/.gitkeep
/characters/*
!/characters/.gitkeep

# ===== created while Knome runs =====
/.knome-state/
/image-server.log
/*.log
.env

# ===== build output (rebuilt by install.sh) =====
/llama.cpp/build/
/llama.cpp/tools/ui/node_modules/
/llama.cpp/tools/ui/dist/
/llama.cpp/tools/ui/.svelte-kit/
/llama.cpp/tools/ui/static/pwa-*.png
/llama.cpp/tools/ui/static/maskable-icon-*.png
/llama.cpp/tools/ui/static/apple-touch-icon-*.png
/llama.cpp/tools/ui/static/apple-splash-*.png
/llama.cpp/tools/ui/static/favicon*.ico
/llama.cpp/tools/ui/static/favicon*.svg
/stable-diffusion.cpp/build/
/core-tools/venv/
/core-tools/__pycache__/
**/__pycache__/
*.pyc
.DS_Store
*.swp
EOF

# ------------------------------------------------------------ ready folders ---
mkdir -p models image-models memory slots characters
for d in diffusion_models checkpoints text_encoders vae loras controlnet clip_vision recipes; do
    mkdir -p "image-models/$d"; touch "image-models/$d/.gitkeep"
done
touch memory/.gitkeep slots/.gitkeep characters/.gitkeep
cat > models/README.txt <<'EOT'
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
cat > image-models/README.txt <<'EOT'
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

# -------------------------------------------------------------------- stage ---
git add -A
echo
echo "Files staged: $(git ls-files | wc -l)"
echo
echo "Still ignored (this must be only private data or build output):"
git status --ignored --short | grep '^!!' | sed 's/^!! /   /' \
  | grep -v -E '/node_modules/$|/dist/$|/\.svelte-kit/$|/build/$|__pycache__|/venv/$' || true
echo
echo "Source-like files that are ignored (this list MUST be empty):"
bad=$(git ls-files --others --ignored --exclude-standard 2>/dev/null \
  | grep -E '\.(ts|tsx|js|svelte|css|html|cpp|c|h|hpp|cu|py|sh|md|json|txt|cmake|comp|glsl)$' \
  | grep -v -E '^(models|image-models|memory|slots|characters)/|^\.knome-state/|^image-server\.log$|node_modules/|/dist/|\.svelte-kit/|/build/|__pycache__|/venv/|/static/(pwa-|maskable-|apple-)' | head -40)
if [ -z "$bad" ]; then echo "   (none)"; else echo "$bad" | sed 's/^/   /'; fi
echo
echo "Next:  git commit -m \"Complete, identical copy of Knome\"  &&  git push"
