#!/usr/bin/env bash
# Looks for things you probably do not want in a public repository:
# personal paths, e-mail addresses, log files, model files, stray build folders.
# Usage: ./tools/check-before-publish.sh
cd "$(dirname "$0")/.." || exit 1
bad=0
say() { printf '  ! %s\n' "$*"; bad=1; }
echo "Checking Knome.mi for personal data ..."

user="$(id -un)"
# 1. your user name / home path inside tracked text files (own code only)
pat="/home/$user|/Users/$user|\\b$user@"
if git rev-parse --git-dir >/dev/null 2>&1; then files="$(git ls-files | grep -v -E '^(llama\.cpp/(ggml|src|tests|docs|models|vendor)|stable-diffusion\.cpp)/')"
else files="$( { find . -maxdepth 1 -type f; find docs tools core-tools characters llama.cpp/tools/ui/src llama.cpp/tools/server -type f -not -path '*/node_modules/*' -not -path '*/vendors/*' 2>/dev/null; } | grep -v -E '\.(png|jpg|jpeg|webp|ico|woff2?|gguf|log)$|gitignore-additions' )"; fi
while IFS= read -r f; do
    [ -f "$f" ] || continue
    if grep -I -n -E "$pat" "$f" >/dev/null 2>&1; then say "personal path/name in $f"; fi
done <<< "$files"

# 2. e-mail addresses in own files
while IFS= read -r f; do
    [ -f "$f" ] || continue
    case "$f" in */vendors/*|*/node_modules/*|*package-lock.json|*.srpm.spec) continue;; esac
    if grep -I -n -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' "$f" 2>/dev/null | grep -v -E 'noreply|example\.(com|org)' | grep -q .; then say "e-mail address in $f"; fi
done <<< "$files"

# 3. files that must never be published
for f in image-server.log .knome-state memory slots; do
    if git rev-parse --git-dir >/dev/null 2>&1 && git ls-files --error-unmatch "$f" >/dev/null 2>&1; then say "$f is tracked by git (remove it: git rm -r --cached $f)"; fi
done
if git rev-parse --git-dir >/dev/null 2>&1; then
    git ls-files | grep -E '\.(gguf|safetensors|ckpt|pt|bin)$' | head -5 | while read -r f; do say "model file tracked: $f"; done
fi

[ "$bad" = 0 ] && echo "  All clear." || echo "Fix the lines marked with ! before publishing."
exit "$bad"
