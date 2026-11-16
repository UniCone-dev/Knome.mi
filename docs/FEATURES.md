# Knome features

## Chat and models
- Local GGUF models through llama.cpp, router mode: put models in `models/`, load/unload them in the **Models** window.
- **Vision**: per-model mmproj choice (Models > Vision). Flat `mmproj-*.gguf` files are attached automatically.
- Header shows the model and context usage; click them for details (quant, size, context, memory).
- Built-in tools: memory, web search, Wikipedia, Python (`core-tools/`), plus any MCP server you add in Settings.
- Reasoning blocks, tool activity, modern tables, code blocks, math/science formula keypad, emoji picker.

## Your space
- **Library**: every picture and file from your chats in one place, jump back to the message.
- **Scheduled** messages: write now, send later (+ menu > Scheduled).
- **Memory**: facts the AI keeps about you (Settings > Profile), and **full backups** (selectable) in Settings > Import/Export.
- **Projects** and search across chats.

## Characters
- Character cards with avatars and backgrounds, **Messenger layout** (reactions, star, search in chat, starred messages, export, hide)
  and **DeepMind mode** (the AI becomes the contact and texts like a person).

## Looks
- Themes: system, Sage, and more, light/dark. Modern input bar (Classic is available), modern writing style.
- **Experience modes** (asked on first start, changeable any time): Clean & Minimal, Pro, Free.

## Images and video
- + menu > **Create image / Create video**, or just ask. See [IMAGE.md](IMAGE.md).
- Smart workload: text model off, image model on, picture made, image model off, text model back. Turns on by itself when the image server is found (you can switch it off).
- Tell the AI what you want: "16:9, high quality, 40 steps, seed 7, no text". Attach a picture to edit it.

## Living characters
- Characters > **Edit emotions**: give a character idle, listening, thinking and speaking states and about 50 emotions.
  Every emotion has 3 parts: **Start** (idle to the emotion), **Loop** (seamless) and **End** (back to idle). Files: mp4, webm, gif, png.
- Each emotion also has a **Speaking** version (for example happily speaking). Timing is adjustable (1-5 s). Saved in the character card and exported with it.
- In the chat the character plays: idle, thinking, speaking, feeling, idle. The AI picks the emotion with a hidden `[emo:name]` tag.
- Show it **in the profile picture** (default) or as a **floating window** you can drag anywhere. Switch it off any time (Characters > Living character).

## System control (off by default)
- Turn it on with `./Knome-start.sh --settings`. The AI gets one `system` tool: open apps, play music or video by name, volume, brightness, Wi-Fi, Bluetooth,
  open settings, find / install / remove apps (Flathub or apt), system info and, as a last resort, run a terminal command.
- **Every single call asks you first** (Allow once or Deny, with the exact command shown). "Always allow" does not exist for this tool. sudo is never used.
- **Command memory** (Settings > Tools): commands that you allowed and that worked are remembered, so the AI reuses them. If it does not know a command it searches the web first.
- A command can still do harm. Read the card before you allow it. See the warning in Settings > Tools.
