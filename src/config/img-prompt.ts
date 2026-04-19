/**
 * System prompts for AI image generation
 * These prompts are appended to user input but hidden from user center display
 */

// Marker used to identify system prompts (for filtering in user center)
export const SYSTEM_PROMPT_MARKER = '|||SYSTEM_PROMPT|||';

// Negative prompt for hairstyle generation (passed as separate API parameter)
export const HAIRSTYLE_NEGATIVE_PROMPT = [
  'glossy synthetic hair',
  'hard cutout lines',
  'floating wig',
  'plastic render',
  'cartoon',
  'anime',
  'drawing',
  'deformed face',
  'extra fingers',
  'blurry face',
].join(', ');

/**
 * Build a natural-language hairstyle prompt.
 *
 * The prompt explicitly assigns roles to each input image so multi-image
 * models (Nano Banana Pro / Gemini 3) know which is the person and which
 * is the hairstyle reference.
 *
 * When `styledPrompt` is provided (a vision-model-generated engineered
 * description of the target hairstyle), it becomes the authoritative style
 * signal and the reference image is demoted to a shape hint — with an
 * explicit instruction to ignore cutout artifacts. This makes generation
 * robust to imperfect manual cutouts in the reference PNG library.
 *
 * @param hairstyleName      e.g. "Short Textured Fade"
 * @param tags               e.g. ["short", "textured", "fade", "modern"]
 * @param userPrompt         optional extra instructions from the user
 * @param subjectImageCount  number of user-uploaded person photos (0 in text-to-image)
 * @param styledPrompt       optional engineered description of the target hairstyle
 *                           (from hairstyle.prompt column). Preferred over name+tags.
 */
export function buildHairstylePrompt(
  hairstyleName: string,
  tags: string[] = [],
  userPrompt: string = '',
  subjectImageCount: number = 0,
  styledPrompt: string = ''
): string {
  const parts: string[] = [];
  const hasStyledPrompt = styledPrompt.trim().length > 0;

  // --- Image role assignment (critical for multi-image models) ---
  if (subjectImageCount > 0) {
    const refIndex = subjectImageCount + 1;
    if (subjectImageCount === 1) {
      parts.push(
        `Image 1 is the person's photo. Image ${refIndex} is a hairstyle reference.`
      );
    } else {
      parts.push(
        `Images 1–${subjectImageCount} are photos of the same person. Image ${refIndex} is a hairstyle reference.`
      );
    }

    // Authoritative target — prefer the engineered description over the name.
    if (hasStyledPrompt) {
      parts.push(
        `Target hairstyle (authoritative description): ${styledPrompt}`,
        `The reference image shows this hairstyle as a rough manual cutout on a transparent/plain background. Use the image ONLY to disambiguate shape details that the text leaves ambiguous. Ignore any cutout edges, halos, transparent areas, stray pixels, or segmentation artifacts in the reference — those are not part of the hairstyle. Do NOT replicate the reference's background, framing, or body outline.`,
        `Change ONLY the hair of the person to match the target hairstyle described above.`,
        `Adapt the hairstyle to the person's own head shape, hairline, forehead, temples, and face proportions. Do NOT transplant or paste the exact hair silhouette from the reference.`
      );
    } else {
      // Fallback: older records without an engineered description.
      parts.push(
        `Change ONLY the hair of the person to a ${hairstyleName} style.`,
        `Use the hairstyle reference as a style guide only — for the haircut shape, length, texture, and styling direction.`,
        `Adapt the hairstyle to the person's own head shape, hairline, forehead, temples, and face proportions. Do NOT transplant or paste the exact hair silhouette from the reference.`
      );
    }
  } else {
    // text-to-image: no person photo, no reference image — text only.
    if (hasStyledPrompt) {
      parts.push(
        `Generate a photorealistic portrait of a person with the following hairstyle: ${styledPrompt}`
      );
    } else {
      parts.push(`Generate a person with a ${hairstyleName} hairstyle.`);
    }
  }

  // Hairstyle tags
  if (tags.length > 0) {
    parts.push(`Style characteristics: ${tags.join(', ')}.`);
  }

  // User's own description
  if (userPrompt) {
    parts.push(userPrompt);
  }

  // Physical realism constraints (only for image-to-image editing)
  if (subjectImageCount > 0) {
    parts.push(
      "Preserve the person's face, identity, skin tone, expression, pose, clothing, and background exactly.",
      'The hair must look naturally growing from the scalp: natural root transition, visible hairline, realistic parting, sideburn blend, and temple coverage.',
      "Match the original photo's lighting, shadows, noise level, and sharpness — do not over-render or over-sharpen the hair.",
      'Keep the original hair color unless explicitly asked to change it.'
    );
  }

  return `${parts.join(' ')} ${SYSTEM_PROMPT_MARKER}`;
}
