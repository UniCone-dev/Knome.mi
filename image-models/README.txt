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
