export const WORKFLOW_TEMPLATE = {
    "3": {
        "inputs": {
            "model": [
                "75",
                0
            ],
            "positive": [
                "111",
                0
            ],
            "negative": [
                "110",
                0
            ],
            "latent_image": [
                "88",
                0
            ],
            "seed": 244483072768816,
            "steps": 20,
            "cfg": 2.5,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 1
        },
        "class_type": "KSampler",
        "_meta": {
            "title": "KSampler"
        }
    },
    "8": {
        "inputs": {
            "samples": [
                "3",
                0
            ],
            "vae": [
                "39",
                0
            ]
        },
        "class_type": "VAEDecode",
        "_meta": {
            "title": "VAEDecode"
        }
    },
    "37": {
        "inputs": {
            "unet_name": "qwen_image_edit_2509_fp8_e4m3fn.safetensors",
            "weight_dtype": "default"
        },
        "class_type": "UNETLoader",
        "_meta": {
            "title": "UNETLoader"
        }
    },
    "38": {
        "inputs": {
            "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
            "type": "qwen_image",
            "device": "default"
        },
        "class_type": "CLIPLoader",
        "_meta": {
            "title": "CLIPLoader"
        }
    },
    "39": {
        "inputs": {
            "vae_name": "qwen_image_vae.safetensors"
        },
        "class_type": "VAELoader",
        "_meta": {
            "title": "VAELoader"
        }
    },
    "60": {
        "inputs": {
            "images": [
                "8",
                0
            ],
            "filename_prefix": "ComfyUI"
        },
        "class_type": "SaveImage",
        "_meta": {
            "title": "SaveImage"
        }
    },
    "66": {
        "inputs": {
            "model": [
                "89",
                0
            ],
            "shift": 3
        },
        "class_type": "ModelSamplingAuraFlow",
        "_meta": {
            "title": "ModelSamplingAuraFlow"
        }
    },
    "75": {
        "inputs": {
            "model": [
                "66",
                0
            ],
            "strength": 1
        },
        "class_type": "CFGNorm",
        "_meta": {
            "title": "CFGNorm"
        }
    },
    "78": {
        "inputs": {
            "image": "Generated Image January 03, 2026 - 1_58PM.jpeg",
            "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": {
            "title": "LoadImage"
        }
    },
    "88": {
        "inputs": {
            "pixels": [
                "390",
                0
            ],
            "vae": [
                "39",
                0
            ]
        },
        "class_type": "VAEEncode",
        "_meta": {
            "title": "VAEEncode"
        }
    },
    "89": {
        "inputs": {
            "model": [
                "37",
                0
            ],
            "lora_name": "Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors",
            "strength_model": 1
        },
        "class_type": "LoraLoaderModelOnly",
        "_meta": {
            "title": "LoraLoaderModelOnly"
        }
    },
    "106": {
        "inputs": {
            "image": "image_qwen_image_edit_2509_input_image.png",
            "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": {
            "title": "LoadImage"
        }
    },
    "108": {
        "inputs": {
            "image": "image_qwen_image_edit_2509_input_image.png",
            "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": {
            "title": "LoadImage"
        }
    },
    "110": {
        "inputs": {
            "clip": [
                "38",
                0
            ],
            "vae": [
                "39",
                0
            ],
            "image1": [
                "390",
                0
            ],
            "image2": [
                "106",
                0
            ],
            "image3": [
                "108",
                0
            ],
            "prompt": ""
        },
        "class_type": "TextEncodeQwenImageEditPlus",
        "_meta": {
            "title": "TextEncodeQwenImageEditPlus"
        }
    },
    "111": {
        "inputs": {
            "clip": [
                "38",
                0
            ],
            "vae": [
                "39",
                0
            ],
            "image1": [
                "390",
                0
            ],
            "image2": [
                "106",
                0
            ],
            "image3": [
                "108",
                0
            ],
            "prompt": "change color of her pants to red"
        },
        "class_type": "TextEncodeQwenImageEditPlus",
        "_meta": {
            "title": "TextEncodeQwenImageEditPlus"
        }
    },
    "112": {
        "inputs": {
            "width": 1024,
            "height": 1024,
            "batch_size": 1
        },
        "class_type": "EmptySD3LatentImage",
        "_meta": {
            "title": "EmptySD3LatentImage"
        }
    },
    "335": {
        "inputs": {
            "model": [
                "339",
                0
            ],
            "strength": 1
        },
        "class_type": "CFGNorm",
        "_meta": {
            "title": "CFGNorm"
        }
    },
    "336": {
        "inputs": {
            "samples": [
                "340",
                0
            ],
            "vae": [
                "337",
                0
            ]
        },
        "class_type": "VAEDecode",
        "_meta": {
            "title": "VAEDecode"
        }
    },
    "337": {
        "inputs": {
            "vae_name": "qwen_image_vae.safetensors"
        },
        "class_type": "VAELoader",
        "_meta": {
            "title": "VAELoader"
        }
    },
    "338": {
        "inputs": {
            "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
            "type": "qwen_image",
            "device": "default"
        },
        "class_type": "CLIPLoader",
        "_meta": {
            "title": "CLIPLoader"
        }
    },
    "339": {
        "inputs": {
            "model": [
                "354",
                0
            ],
            "shift": 3
        },
        "class_type": "ModelSamplingAuraFlow",
        "_meta": {
            "title": "ModelSamplingAuraFlow"
        }
    },
    "340": {
        "inputs": {
            "model": [
                "335",
                0
            ],
            "positive": [
                "395",
                0
            ],
            "negative": [
                "347",
                0
            ],
            "latent_image": [
                "375",
                0
            ],
            "seed": 901405604065525,
            "steps": 4,
            "cfg": 1,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": 1
        },
        "class_type": "KSampler",
        "_meta": {
            "title": "KSampler"
        }
    },
    "341": {
        "inputs": {
            "unet_name": "qwen_image_edit_2509_fp8_e4m3fn.safetensors",
            "weight_dtype": "default"
        },
        "class_type": "UNETLoader",
        "_meta": {
            "title": "UNETLoader"
        }
    },
    "342": {
        "inputs": {
            "images": [
                "336",
                0
            ],
            "filename_prefix": "ComfyUI"
        },
        "class_type": "SaveImage",
        "_meta": {
            "title": "SaveImage"
        }
    },
    "345": {
        "inputs": {
            "width": 1024,
            "height": 1024,
            "batch_size": 1
        },
        "class_type": "EmptySD3LatentImage",
        "_meta": {
            "title": "EmptySD3LatentImage"
        }
    },
    "347": {
        "inputs": {
            "clip": [
                "338",
                0
            ],
            "prompt": ""
        },
        "class_type": "TextEncodeQwenImageEditPlus",
        "_meta": {
            "title": "TextEncodeQwenImageEditPlus"
        }
    },
    "348": {
        "inputs": {
            "clip": [
                "338",
                0
            ],
            "prompt": "Change the time to night, keep the same scene"
        },
        "class_type": "TextEncodeQwenImageEditPlus",
        "_meta": {
            "title": "TextEncodeQwenImageEditPlus"
        }
    },
    "349": {
        "inputs": {
            "image": "image_qwen_image_edit_2509_input_image-2.png",
            "upload": "image"
        },
        "class_type": "LoadImage",
        "_meta": {
            "title": "LoadImage"
        }
    },
    "354": {
        "inputs": {
            "model": [
                "341",
                0
            ],
            "lora_name": "Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors",
            "strength_model": 1
        },
        "class_type": "LoraLoaderModelOnly",
        "_meta": {
            "title": "LoraLoaderModelOnly"
        }
    },
    "375": {
        "inputs": {
            "pixels": [
                "397",
                0
            ],
            "vae": [
                "337",
                0
            ]
        },
        "class_type": "VAEEncode",
        "_meta": {
            "title": "VAEEncode"
        }
    },
    "390": {
        "inputs": {
            "image": [
                "78",
                0
            ]
        },
        "class_type": "FluxKontextImageScale",
        "_meta": {
            "title": "FluxKontextImageScale"
        }
    },
    "395": {
        "inputs": {
            "conditioning": [
                "348",
                0
            ],
            "latent": [
                "375",
                0
            ]
        },
        "class_type": "ReferenceLatent",
        "_meta": {
            "title": "ReferenceLatent"
        }
    },
    "397": {
        "inputs": {
            "image": [
                "349",
                0
            ]
        },
        "class_type": "FluxKontextImageScale",
        "_meta": {
            "title": "FluxKontextImageScale"
        }
    }
} as const;
