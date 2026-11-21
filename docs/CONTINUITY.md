# Context continuity and "edit the last picture"

## Context continuity (Settings > Profile)

A long chat fills the model's context. Knome carries the important parts over to a fresh, linked chat.

| Mode | What happens |
|---|---|
| **Automatic** (default) | When the context reaches the threshold (default 90%) and a reply has finished, Knome summarizes the chat with your local model and opens a new chat. |
| **Manual** | At the threshold a "Continue in new context" button appears. Nothing happens until you press it. |
| **Off** | No handoff. |

What the new chat gets: a rolling **summary** (goal, decisions, progress, open tasks, what it learned about you, important details, tone), plus the **last messages word for word** (default 4, you can change it), plus your normal **memory**. It keeps the same **character**, project, tools and thinking settings.

- The old chat is never changed or deleted. The new chat shows "Continued from ..." and a "What I remember" view with the summary.
- If a chat is handed over again, the old summary is **updated**, not overwritten.
- If summarizing fails, nothing happens except a message with **Retry**.
- Long chats are summarized in small pieces, so the summarizer itself never overflows the context.
- "Also save a summary to memory at 90%" is the older helper (the AI saves a summary you can recall with `@chat "Name"`). On by default as before; switch it off if the handoff is enough for you.

Not built yet (planned): the side panel where a separate model only makes summaries/memory without touching the main chat.

## Edit the last picture without attaching it again (Settings > Image & video)

With "Remember the last picture" on (default), you can write "make it brighter" or "isko night bana do" after a picture was made (or attached earlier in the chat). The AI adds `edit="last"` to its image tag and Knome sends the latest picture to the generator. Ask for something completely new and the AI uses `edit="none"`. If the AI forgets the tag, clear wording ("make it ...", "same picture but ...") is also detected.
