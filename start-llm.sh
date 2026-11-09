#!/usr/bin/env bash
# Legacy name, kept for backward compatibility. Just calls start-knome.sh.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/start-knome.sh" "$@"
