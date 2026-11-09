#!/usr/bin/env bash
# Run this once: sets up "start-ai" / "start-knome" as terminal commands,
# so you can launch Knome (model + built-in tools together) from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SHELL_RC="$HOME/.bashrc"
if [ -n "$ZSH_VERSION" ] || [ "$(basename "$SHELL")" = "zsh" ]; then
    SHELL_RC="$HOME/.zshrc"
fi

add_alias() {
    local name="$1" target="$2"
    if grep -q "alias $name=" "$SHELL_RC" 2>/dev/null; then
        sed -i "/alias $name=/c\\alias $name='$target'" "$SHELL_RC"
        echo "Updated alias: $name"
    else
        echo "alias $name='$target'" >> "$SHELL_RC"
        echo "Added alias: $name"
    fi
}

chmod +x "$SCRIPT_DIR"/*.sh

add_alias "start-ai"     "$SCRIPT_DIR/start-knome.sh"
add_alias "start-knome" "$SCRIPT_DIR/start-knome.sh"
add_alias "knome"       "$SCRIPT_DIR/start-knome.sh"
add_alias "start-llm"    "$SCRIPT_DIR/start-knome.sh"   # backward-compat
add_alias "start-animus" "$SCRIPT_DIR/start-knome.sh"   # backward-compat

echo ""
echo "Done. Open a new terminal, or run:"
echo "  source $SHELL_RC"
echo ""
echo "Then the command will be available: start-ai (also: knome, start-knome)"
echo "This one command starts both the model and the built-in tools"
echo "(memory, web search) -- nothing else needs to be run separately."
