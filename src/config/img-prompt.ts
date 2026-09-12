/**
 * System prompts for AI image generation
 * These prompts are appended to user input but hidden from user center display
 */

// Marker used to identify system prompts (for filtering in user center)
export const SYSTEM_PROMPT_MARKER = '|||SYSTEM_PROMPT|||';

// Negative prompt for brow tint generation (passed as separate API parameter)
export const BROW_TINT_NEGATIVE_PROMPT = [
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
 * Build a natural-language brow tint prompt.
 *
 * The prompt explicitly assigns roles to each input image so multi-image
 * models (Nano Banana Pro / Gemini 3) know which is the person and which
 * is the brow tint reference.
 *
 * When `styledPrompt` is provided (a vision-model-generated engineered
 * description of the target brow tint style), it should reinforce the reference
 * image rather than override it. The reference image remains the primary
 * visual authority for the brow tint style, while the text helps clarify details
 * that may be harder to infer from the cutout alone.
 *
 * @param browTintName       e.g. "Short Textured Fade"
 * @param tags               e.g. ["short", "textured", "fade", "modern"]
 * @param userPrompt         optional extra instructions from the user
 * @param subjectImageCount  number of user-uploaded person photos (0 in text-to-image)
 * @param styledPrompt       optional engineered description of the target brow tint style
 *                           (from brow tint.prompt column). Preferred over name+tags.
 */
export function buildBrowTintPrompt(
  browTintName: string,
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
        `Image 1 is the person's photo. Image ${refIndex} is a brow tint reference.`
      );
    } else {
      parts.push(
        `Images 1–${subjectImageCount} are photos of the same person. Image ${refIndex} is a brow tint reference.`
      );
    }

    // Reference-first target: keep the haircut faithful to the reference image.
    if (hasStyledPrompt) {
      parts.push(
        `Target brow tint style (supporting description): ${styledPrompt}`,
        `The brow tint reference image is the primary visual authority for the target brow tint style.`,
        `Match the brow tint style in the reference image as closely as possible, especially the overall silhouette, fringe or bangs shape, parting, fade or taper placement, sideburn shape, length distribution, and texture direction.`,
        `Use the supporting description to reinforce the reference image, not to override it.`,
        `The reference image may be a rough manual cutout on a transparent/plain background. Ignore any cutout edges, halos, transparent areas, stray pixels, or segmentation artifacts in the reference — those are not part of the brow tint style. Do NOT replicate the reference's background, framing, or body outline.`,
        `Change ONLY the hair of the person to match the reference brow tint style.`,
        `Recreate the same brow tint style naturally on the person's head while adapting it to the person's own head shape, hairline, forehead, temples, and face proportions. Do NOT paste the cutout itself onto the person.`
      );
    } else {
      // Fallback: older records without an engineered description.
      parts.push(
        `Change ONLY the hair of the person to match the ${browTintName} brow tint reference image.`,
        `Use the brow tint reference image as the primary source of truth for the brow tint style's shape, silhouette, length, texture, parting, fade or taper placement, and styling direction.`,
        `Match the brow tint style in the reference image as closely as possible while adapting it naturally to the person's own head shape, hairline, forehead, temples, and face proportions.`,
        `Do NOT paste the cutout itself onto the person.`
      );
    }
  } else {
    // text-to-image: no person photo, no reference image — text only.
    if (hasStyledPrompt) {
      parts.push(
        `Generate a photorealistic portrait of a person with the following brow tint style: ${styledPrompt}`
      );
    } else {
      parts.push(`Generate a person with a ${browTintName} brow tint style.`);
    }
  }

  // Brow tint tags
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

export function buildBrowStylePrompt({
  name,
  shade,
  shape,
  intensity,
  styledPrompt,
  userPrompt = '',
  subjectImageCount,
  browMapping = false,
  preserveBrowShape = false,
}: {
  name: string;
  shade: string;
  shape: string;
  intensity: string;
  styledPrompt: string;
  userPrompt?: string;
  subjectImageCount: number;
  browMapping?: boolean;
  preserveBrowShape?: boolean;
}): string {
  // Opt-in request flag keeps older clients and the unchecked mode unchanged.
  // Do not append catalog/user prose here: it may redefine the confirmed shape.
  if (browMapping && preserveBrowShape) {
    return [
      "Image 1 is the user's original portrait and is the sole identity authority. Edit this photograph.",
      'Image 2 is the confirmed brow mapping guide and is the placement and contour authority for both eyebrows. Its white closed outlines define the target shape on the same portrait.',
      'Follow each outlined brow independently: head, arch, tail, width, length, height, spacing and angle. Preserve the confirmed left/right differences. Do not revert to the original brow silhouette or substitute the sample silhouette.',
      'Image 3 is the selected brow style sample and is the appearance authority for hair density, individual hair strokes, hair flow, softness and root-to-tip gradient only.',
      "Fit Image 3's hair appearance inside Image 2's target contours. Hair density does not mean brow width: dense or sparse hairs must still fit the confirmed outline. The sample must not move, widen, lengthen or reshape the target brows.",
      'Edit the combined area of the original and target eyebrows. Remove original eyebrow hairs outside the target contours and restore natural skin there; render realistic brow hairs inside the target contours. Avoid double brows, leftover tails and pasted-on edges.',
      "Preserve the person's face, identity, eyes, eyelashes, skin tone, expression, pose, makeup, hair, clothing, background, framing and lighting outside that edit area. Match the original photograph's sharpness and grain.",
      'Do not reproduce white guide marks, control points, labels or the sample background. Return only the finished portrait.',
      SYSTEM_PROMPT_MARKER,
    ].join(' ');
  }

  const parts: string[] = [];

  if (browMapping) {
    parts.push(
      "Image 1 is the user's original portrait and is the sole identity authority.",
      'Image 2 is the confirmed brow mapping guide and is the placement and contour authority for both eyebrows; it is an annotation guide, not a user portrait.',
      'Image 3 is the selected brow style sample and is the appearance authority for shade, fill density, stroke texture, intensity, and gradient; it is a style reference, not a user portrait.',
      "Apply Image 3's brow appearance within the confirmed placement and contours from Image 2. Do not reproduce the white guide marks in the result."
    );
  } else if (subjectImageCount >= 1) {
    if (subjectImageCount === 1) {
      parts.push("Image 1 is the user's portrait photo.");
    } else {
      parts.push(
        `Images 1-${subjectImageCount} are the user's portrait photos.`
      );
    }
  }

  parts.push(
    `Selected brow style: ${name}.`,
    `Primary style authority: shade ${shade}, shape ${shape}, intensity ${intensity}.`,
    'Tint the eyebrows in-place using brow shape, arch, tail, fill density, individual-stroke versus solid texture, tint color, intensity, and root-to-tip gradient as the only style dimensions.',
    "Preserve the person's face, identity, skin tone, expression, pose, makeup, clothing, background, and lighting."
  );

  if (browMapping) {
    parts.push(
      'Only the eyebrow region should change. Keep the eyebrow placement and closed contours defined by the confirmed mapping guide.'
    );
  } else {
    parts.push(
      "Only the eyebrow region should change. Keep brow position and the user's natural brow shape unless the selected shape clearly calls for a different brow shape."
    );
  }

  parts.push(
    `Supporting style description from the selected brow style: ${styledPrompt}`
  );

  const trimmedUserPrompt = userPrompt.trim();
  if (trimmedUserPrompt) {
    parts.push(`User's extra instruction: ${trimmedUserPrompt}`);
  }

  return `${parts.join(' ')} ${SYSTEM_PROMPT_MARKER}`;
}
