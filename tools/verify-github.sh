#!/usr/bin/env bash
# After "git push": clones your GitHub repo into a temp folder and compares it with this working folder.
# Everything that is not private data must be identical. Usage: bash tools/verify-github.sh
cd "$(dirname "$0")/.." || exit 1
url="$(git remote get-url origin 2>/dev/null)" || { echo "No git remote 'origin'."; exit 1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
echo "Cloning $url ..."
git clone --quiet "$url" "$T/clone" || exit 1
a="$T/a.txt"; b="$T/b.txt"
git ls-files -c -o --exclude-standard -z | xargs -0 sha1sum 2>/dev/null | sort -k2 > "$a"
( cd "$T/clone" && git ls-files -z | xargs -0 sha1sum 2>/dev/null | sort -k2 ) > "$b"
echo "Files here (not ignored): $(wc -l < "$a")   Files on GitHub: $(wc -l < "$b")"
if diff -q "$a" "$b" >/dev/null; then echo "IDENTICAL: GitHub has exactly your files."; else
  echo "DIFFERENT (< = only here, > = only/different on GitHub):"; diff "$a" "$b" | head -40; fi
echo
echo "Required files:"
miss=0
for f in install.sh Knome-start.sh start-knome.sh llama.cpp/CMakeLists.txt llama.cpp/tools/ui/package.json \
  llama.cpp/tools/ui/src/lib/stores/models stable-diffusion.cpp/CMakeLists.txt models/README.txt image-models/README.txt \
  image-models/vae/.gitkeep memory/.gitkeep slots/.gitkeep; do
  if [ -e "$T/clone/$f" ]; then echo "   ok   $f"; else echo "   MISSING  $f"; miss=1; fi
done
[ "$miss" = 0 ] && echo "All required files are there."
