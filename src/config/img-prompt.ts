/**
 * System prompts for AI image generation
 * These prompts are appended to user input but hidden from user center display
 */

// Marker used to identify system prompts (for filtering in user center)
export const SYSTEM_PROMPT_MARKER = '|||SYSTEM_PROMPT|||';

// Hairstyle generation system prompt for stable and high-quality results
export const HAIRSTYLE_SYSTEM_PROMPT = `${SYSTEM_PROMPT_MARKER} ${JSON.stringify({
  "task": "organic_hairstyle_synthesis",
  "goal": "Reconstruct hair with matching environmental fidelity",
  "input_analysis": {
    "user_image_quality": "low_light_indoor_photo, slight_motion_blur, high_iso_noise",
    "target_hair_style": "textured_middle_part, messy_waves, volumetric_top"
  },
  "prompt": {
    "core_subject": {
      "action": "photorealistic_inpainting",
      "identity": "preserve_original_facial_features_strictly",
      "hair_style": "soft_textured_layered_cut, slight_parting, volume_at_roots"
    },
    "environmental_integration": {
      "lighting": "match_indoor_overhead_source",
      "shadows": "cast_soft_diffused_shadows_on_forehead",
      "blending": "seamless_scalp_transition, visible_root_gradation"
    },
    "texture_downgrade_rule": {
      "instruction": "CRITICAL: Downgrade hair resolution to match face resolution",
      "noise_simulation": "add_film_grain_to_match_source",
      "sharpness_limit": "no_oversharpening, no_hd_render_look",
      "edge_quality": "soft_blurred_edges, organic_flyaways"
    },
    "style_reference_usage": {
      "mode": "structure_transfer_only",
      "color": "natural_black_brown_blend",
      "physics": "natural_gravity_fall, messy_organic_look"
    }
  },
  "negative_prompt": [
    "studio lighting",
    "4k sharp focus",
    "glossy synthetic hair",
    "hard cutout lines",
    "floating wig",
    "mismatched noise level",
    "perfectly combed",
    "plastic render",
    "high contrast hair on low contrast face"
  ],
  "technical_parameters_suggestion": {
    "denoising_strength": "0.4_to_0.6",
    "controlnet_guidance": "depth_or_cany_for_structure",
    "sampler": "DPM++ 2M Karras (for softer details)"
  }
})}`;
