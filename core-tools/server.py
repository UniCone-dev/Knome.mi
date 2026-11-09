"""
Knome Core Tools -- runs as a stdio subprocess spawned DIRECTLY by
llama-server itself (via --mcp-servers-json / --mcp-servers-config).
No network port, no CORS, no browser involvement: the C++ server talks
to this script over stdin/stdout, same as any other built-in tool.
"""

from mcp.server.mcpserver import MCPServer
from ddgs import DDGS
import httpx
from bs4 import BeautifulSoup
import wikipedia
import subprocess
import json
import os
import re
from datetime import datetime

mcp = MCPServer("knome-core")

KNOME_ROOT = os.environ.get("KNOME_ROOT", os.path.expanduser("~/Knome.mi"))
MEMORY_ROOT = os.path.join(KNOME_ROOT, "memory")
GLOBAL_CHAT = "global"


def _safe_chat_dir(chat_name: str) -> str:
    """Turn a free-text chat name into a safe folder name and ensure it exists.
    Every distinct chat_name gets its own folder under MEMORY_ROOT, so memory
    naturally stays scoped per-conversation unless chat_name="global" is used.
    """
    chat_name = (chat_name or GLOBAL_CHAT).strip() or GLOBAL_CHAT
    safe = re.sub(r"[^a-zA-Z0-9 _\-]", "", chat_name).strip() or GLOBAL_CHAT
    path = os.path.join(MEMORY_ROOT, safe)
    os.makedirs(path, exist_ok=True)
    return path


def _memory_file(chat_name: str) -> str:
    return os.path.join(_safe_chat_dir(chat_name), "memory.json")


def _summary_file(chat_name: str) -> str:
    return os.path.join(_safe_chat_dir(chat_name), "summary.txt")


def _load_memories(chat_name: str):
    path = _memory_file(chat_name)
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def _save_memories(chat_name: str, memories) -> None:
    with open(_memory_file(chat_name), "w") as f:
        json.dump(memories, f, indent=2)


def _list_chat_folders():
    if not os.path.isdir(MEMORY_ROOT):
        return []
    return sorted(
        d for d in os.listdir(MEMORY_ROOT)
        if os.path.isdir(os.path.join(MEMORY_ROOT, d))
    )


CHARACTERS_ROOT = os.path.join(KNOME_ROOT, "characters")


def _safe_character_dir(name: str) -> str:
    """Every character gets its own folder under CHARACTERS_ROOT, keyed by a
    filesystem-safe version of its name -- mirrors how _safe_chat_dir scopes
    memory per-chat. Works the same whether the character is one the user
    hand-wrote or one you researched and authored yourself."""
    safe = re.sub(r"[^a-zA-Z0-9 _\-]", "", (name or "").strip()) or "unnamed"
    path = os.path.join(CHARACTERS_ROOT, safe)
    os.makedirs(path, exist_ok=True)
    return path


def _character_file(name: str) -> str:
    return os.path.join(_safe_character_dir(name), "card.json")


def _profile_file() -> str:
    # The user profile always lives in the "global" chat folder -- it's
    # cross-chat by definition, never scoped to one conversation.
    return os.path.join(_safe_chat_dir(GLOBAL_CHAT), "profile.json")


def _load_profile():
    path = _profile_file()
    if not os.path.exists(path):
        return []
    with open(path, "r") as f:
        return json.load(f)


def _save_profile(facts) -> None:
    with open(_profile_file(), "w") as f:
        json.dump(facts, f, indent=2)


# ---------------------------------------------------------------------------
# Memory tools
# ---------------------------------------------------------------------------

@mcp.tool()
def save_memory(content: str, chat_name: str = GLOBAL_CHAT) -> str:
    """Save an important fact for future recall. Use chat_name="global" for
    durable facts about the user that should apply in every conversation
    (name, preferences, ongoing projects). Use the current conversation's
    name as chat_name for facts specific to that one chat."""
    memories = _load_memories(chat_name)
    memories.append({"content": content, "saved_at": datetime.now().isoformat()})
    _save_memories(chat_name, memories)
    return f'Saved to memory ({chat_name}): {content}'


@mcp.tool()
def search_memory(query: str = "", chat_name: str = GLOBAL_CHAT) -> str:
    """Search or list previously saved memories for a chat. Pass
    chat_name="global" for cross-chat facts about the user, a specific
    conversation name to search that chat's memory only, or chat_name="all"
    to search across every saved chat's memory at once."""
    if chat_name == "all":
        results = []
        for name in _list_chat_folders():
            for m in _load_memories(name):
                if not query or query.lower() in m["content"].lower():
                    results.append(f"- [{name}] {m['content']} (saved {m['saved_at'][:10]})")
        return "\n".join(results) if results else "No memories found."

    memories = _load_memories(chat_name)
    if not memories:
        return f"No memories saved yet for '{chat_name}'."
    if query:
        memories = [m for m in memories if query.lower() in m["content"].lower()]
        if not memories:
            return f"No memories matching '{query}' in '{chat_name}'."
    return "\n".join(f"- {m['content']} (saved {m['saved_at'][:10]})" for m in memories)


@mcp.tool()
def delete_memory(content_snippet: str, chat_name: str = GLOBAL_CHAT) -> str:
    """Delete a saved memory matching the given text snippet, from the given
    chat's memory (or "global" for cross-chat facts)."""
    memories = _load_memories(chat_name)
    remaining = [m for m in memories if content_snippet.lower() not in m["content"].lower()]
    removed = len(memories) - len(remaining)
    _save_memories(chat_name, remaining)
    return f"Removed {removed} memory/memories matching '{content_snippet}' from '{chat_name}'."


@mcp.tool()
def list_memory_chats() -> str:
    """List every chat name that currently has saved memory or a summary,
    so you know which conversations you can recall from."""
    chats = _list_chat_folders()
    if not chats:
        return "No chats with saved memory yet."
    return "\n".join(f"- {c}" for c in chats)


@mcp.tool()
def save_chat_summary(chat_name: str, summary: str) -> str:
    """Save a full summary of a conversation, written by you (the model)
    after reviewing everything discussed. Call this when the user asks you
    to summarize the whole conversation/progress, or before context that
    would otherwise be lost. Overwrites any previous summary for this chat_name."""
    with open(_summary_file(chat_name), "w") as f:
        f.write(summary.strip() + f"\n\n(summarized at {datetime.now().isoformat()})")
    return f"Saved summary for '{chat_name}'."


@mcp.tool()
def get_chat_summary(chat_name: str) -> str:
    """Retrieve the saved summary for a specific past conversation by name.
    Use this when the user references an earlier chat by name and wants you
    to recall what it was about."""
    path = _summary_file(chat_name)
    if not os.path.exists(path):
        return f"No summary saved for '{chat_name}' yet."
    with open(path, "r") as f:
        return f.read()


# ---------------------------------------------------------------------------
# User profile (who the user is -- separate from ordinary memories, always
# global/cross-chat, and meant to be checked ON DEMAND rather than always
# force-injected into every system message)
# ---------------------------------------------------------------------------

@mcp.tool()
def get_user_profile() -> str:
    """Look up what you already know about the user you're talking to --
    their name, preferences, background, ongoing projects, how they like to
    be talked to, etc. Call this whenever it would help to know who you're
    talking to: e.g. the user asks "who am I" / "what do you know about me",
    asks for something personalized, or a new conversation starts and
    knowing the user would change how you respond. If this returns nothing,
    the user hasn't told you anything about themselves yet -- don't guess."""
    facts = _load_profile()
    if not facts:
        return "No profile saved yet -- you don't know anything about this user yet."
    return "\n".join(f"- {f['content']} (noted {f['saved_at'][:10]})" for f in facts)


@mcp.tool()
def update_user_profile(fact: str) -> str:
    """Save a durable fact about the user themselves (not about the current
    task) -- their name, role, preferences, ongoing projects, how they like
    responses formatted, etc. Call this whenever the user tells you
    something about themselves worth remembering across every future chat.
    Keep each fact short and self-contained (one sentence)."""
    facts = _load_profile()
    facts.append({"content": fact.strip(), "saved_at": datetime.now().isoformat()})
    _save_profile(facts)
    return f"Saved to your profile: {fact.strip()}"


# ---------------------------------------------------------------------------
# Character cards (AI personas) -- disk-side mirror of the browser's
# character library. Used when YOU (the model) author a profile yourself,
# e.g. after researching a pre-existing character the user named, so it's
# saved locally on disk under characters/<name>/card.json regardless of
# whether that character is copyrighted -- everything here runs on the
# user's own machine for their own local use.
# ---------------------------------------------------------------------------

@mcp.tool()
def save_character_profile(
    name: str,
    gender: str = "",
    description: str = "",
    personality: str = "",
    first_message: str = "",
    tags: str = "",
) -> str:
    """Save (or overwrite) a character profile you have authored, to disk.
    Call this after researching a pre-existing character (anime/game/movie/
    book character the user named) via web_search / wikipedia_search /
    read_webpage, once you've written up a proper profile -- or for a fully
    original character the user described to you. `description` should
    cover appearance and background; `personality` should be the behavior/
    speech-style instructions that will actually steer how you roleplay
    them; `first_message` is an optional greeting line said in-character;
    `tags` is a comma-separated list (e.g. "anime, tsundere, magic"). Saving
    is local-only -- nothing here is uploaded anywhere."""
    path = _character_file(name)
    card = {
        "name": name.strip(),
        "gender": gender.strip(),
        "description": description.strip(),
        "personality": personality.strip(),
        "firstMessage": first_message.strip(),
        "tags": [t.strip() for t in tags.split(",") if t.strip()],
        "savedAt": datetime.now().isoformat(),
    }
    with open(path, "w") as f:
        json.dump(card, f, indent=2)
    return f"Saved character profile for '{name}' to {path}"


@mcp.tool()
def get_character_profile(name: str) -> str:
    """Retrieve a previously saved character profile from disk by name."""
    path = _character_file(name)
    if not os.path.exists(path):
        return f"No saved profile found for '{name}'."
    with open(path, "r") as f:
        return f.read()


@mcp.tool()
def list_character_profiles() -> str:
    """List every character name that has a saved profile on disk."""
    if not os.path.isdir(CHARACTERS_ROOT):
        return "No character profiles saved yet."
    names = sorted(
        d for d in os.listdir(CHARACTERS_ROOT)
        if os.path.isdir(os.path.join(CHARACTERS_ROOT, d))
    )
    return "\n".join(f"- {n}" for n in names) if names else "No character profiles saved yet."


# ---------------------------------------------------------------------------
# Context control
# ---------------------------------------------------------------------------

LLAMA_SERVER_URL = os.environ.get("LLAMA_SERVER_URL", "http://127.0.0.1:8080")


@mcp.tool()
def clear_context() -> str:
    """Immediately wipe the model's live conversation context RIGHT NOW, on
    the user's explicit request (e.g. "clear the context", "wipe out the
    context", "forget everything so far"). This is different from the
    automatic Normal/Full context-shift settings, which only act when the
    context window fills up on its own -- this tool acts instantly, whenever
    called. The conversation stays saved in the chat history; only what the
    model can currently "see" is cleared. Requires the server to have been
    started with --slot-save-path and --parallel 1 (both defaults in
    start-llm.sh)."""
    try:
        resp = httpx.post(
            f"{LLAMA_SERVER_URL}/slots/0",
            params={"action": "erase"},
            timeout=15,
        )
        if resp.status_code == 200:
            return "Context cleared. The model has no memory of anything said before this point."
        return (
            f"Failed to clear context (HTTP {resp.status_code}): {resp.text[:300]}\n"
            "Make sure llama-server was started with --slot-save-path (start-llm.sh does this by default)."
        )
    except Exception as e:
        return f"Error contacting llama-server to clear context: {e}"


# ---------------------------------------------------------------------------
# Web / knowledge tools
# ---------------------------------------------------------------------------

@mcp.tool()
def web_search(query: str, max_results: int = 5) -> str:
    """Search the web using DuckDuckGo. Returns titles, links, and snippets."""
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=max_results))
    if not results:
        return "No results found."
    return "\n\n".join(f"- {r.get('title')}\n  {r.get('href')}\n  {r.get('body')}" for r in results)


@mcp.tool()
def read_webpage(url: str, max_chars: int = 4000) -> str:
    """Fetch a URL and return its readable text content."""
    try:
        resp = httpx.get(url, timeout=15, follow_redirects=True,
                          headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = " ".join(soup.get_text(separator=" ").split())
        return text[:max_chars]
    except Exception as e:
        return f"Error fetching page: {e}"


@mcp.tool()
def wikipedia_search(query: str, sentences: int = 5) -> str:
    """Search Wikipedia and return a summary of the most relevant article."""
    try:
        return wikipedia.summary(query, sentences=sentences, auto_suggest=True)
    except wikipedia.DisambiguationError as e:
        return f"Multiple matches found: {', '.join(e.options[:5])}"
    except Exception as e:
        return f"Error: {e}"


@mcp.tool()
def run_python(code: str) -> str:
    """Execute a Python snippet for calculations/scripts. 10 second timeout."""
    try:
        result = subprocess.run(["python3", "-c", code], capture_output=True, text=True, timeout=10)
        out = result.stdout.strip()
        err = result.stderr.strip()
        return out if out else (err if err else "(no output)")
    except subprocess.TimeoutExpired:
        return "Error: execution timed out (10s limit)"
    except Exception as e:
        return f"Error: {e}"


if __name__ == "__main__":
    os.makedirs(MEMORY_ROOT, exist_ok=True)
    os.makedirs(CHARACTERS_ROOT, exist_ok=True)
    # stdio transport: llama-server spawns this script and talks over
    # stdin/stdout directly. No port, no HTTP, no CORS.
    mcp.run(transport="stdio")
