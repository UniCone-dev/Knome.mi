# Vision Bridge — a text model that can "borrow eyes"

If your main model can't see images, drop a second, vision-capable model
next to it and the text model can call it as a tool whenever it needs to
look at something.

## Setup

```
models/
  your-text-model.gguf              <- your everyday model, no vision
  your-vision-model/
    your-vision-model.gguf          <- any name, just not starting "mmproj"
    mmproj-f16.gguf                 <- must start with "mmproj" (comes with
                                        vision GGUFs, e.g. Gemma 3, Qwen2-VL)
```

That's it — `start-knome.sh` auto-detects this and switches to **router
mode**: llama-server keeps both models available and loads whichever one is
actually requested, on demand. You'll see a log line like:

```
Multiple models found -- starting in router mode:
  - your-text-model
  - your-vision-model
```

## How it behaves

- Pick your text model as usual from the model dropdown in the UI — that's
  what you talk to normally.
- Attach or paste an image into the chat like always.
- If the active model can already see (native vision), nothing changes —
  it just looks at the image directly, same as single-model mode.
- If the active model **can't** see, a new tool called **Vision Bridge**
  becomes available to it automatically. When the model decides it needs
  to understand an image, it calls this tool, which quietly sends the most
  recently attached image(s) to your vision model with a question (either
  a generic "describe this" or something specific the text model asks),
  and gets back a text description — which it then uses to answer you
  normally. You'll see the tool call appear in the chat like any other
  tool use.
- The vision model loads automatically the first time it's actually
  needed (lazy loading) — you don't have to load it manually first.

## Notes

- This only activates in router mode (i.e. only when you actually have 2+
  models in `models/`). A single-model setup behaves exactly as before.
- Works with any number of extra models, not just one vision model — the
  bridge just looks for the first other loaded model that reports vision
  support.
- If you use `core-tools`' `clear_context` tool, router mode needs to know
  which model is "the" text model to target; `start-knome.sh` figures
  this out automatically and passes it along -- no setup needed on your
  end.
