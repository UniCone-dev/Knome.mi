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
