import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

import { getAllConfigs } from '@/shared/models/config';

export interface BrowTintAnalysis {
  name: string;
  tags: string[];
  description: string;
  prompt: string;
}

const VISION_MODEL = 'z-ai/glm-5v-turbo';

const ANALYSIS_INSTRUCTION = `You are analyzing a reference PNG that shows ONLY a brow tint style (the brow area was manually cut out from a portrait; the background may be transparent, black, or have halos/stray pixels from the cutout). Treat those cutout artifacts as noise and describe ONLY the brow tint style itself.

Return ONLY a JSON object with these four fields:
{
  "name": "Short Textured Fade",
  "tags": ["short", "textured", "fade", "modern", "casual"],
  "description": "One sentence, ~15-25 words, describing the brow tint style in plain English for humans (shape, color, overall vibe).",
  "prompt": "A long-form engineered description optimized to be embedded in an image-generation prompt. Be specific about: brow shape and arch, thickness, tint color and intensity, tail behavior, fill density, texture (hair-stroke vs. solid), and which face shapes the style typically flatters. Use neutral descriptive language — do NOT reference the image, cutout, or background."
}

Rules:
- "name" is 2-4 words, English, Title Case.
- "tags" are 3-5 short lowercase English keywords.
- "description" is ONE plain-English sentence.
- "prompt" is 2-4 dense sentences of comma-separated descriptive phrases — written as if it were being inserted into an AI image-generation prompt.
- Output JSON ONLY. No markdown, no code fences, no commentary.`;

const FALLBACK: BrowTintAnalysis = {
  name: 'Brow Tint',
  tags: ['brow tint'],
  description: '',
  prompt: '',
};

function parseAnalysis(text: string): BrowTintAnalysis {
  const jsonMatch = text.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.warn('Failed to parse AI response, using defaults:', text);
    return FALLBACK;
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name:
        typeof parsed.name === 'string' && parsed.name
          ? parsed.name
          : FALLBACK.name,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t: unknown): t is string => typeof t === 'string')
        : FALLBACK.tags,
      description:
        typeof parsed.description === 'string'
          ? parsed.description
          : FALLBACK.description,
      prompt:
        typeof parsed.prompt === 'string' ? parsed.prompt : FALLBACK.prompt,
    };
  } catch (e) {
    console.warn('Failed to JSON.parse AI response, using defaults:', text, e);
    return FALLBACK;
  }
}

async function getOpenRouter() {
  const configs = await getAllConfigs();
  const openrouterApiKey = configs.openrouter_api_key;

  if (!openrouterApiKey) {
    throw new Error('openrouter_api_key is not set');
  }

  const openrouterBaseUrl = configs.openrouter_base_url;

  return createOpenRouter({
    apiKey: openrouterApiKey,
    baseURL: openrouterBaseUrl || undefined,
  });
}

/**
 * Analyze a brow tint style image using OpenRouter Vision API.
 * Returns name, tags, a human-readable description, and an engineered
 * long-form prompt for downstream image-generation use.
 */
export async function analyzeBrowTintWithAI(
  imageUrl: string
): Promise<BrowTintAnalysis> {
  const openrouter = await getOpenRouter();
  const model = openrouter.chat(VISION_MODEL);

  try {
    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_INSTRUCTION },
            { type: 'image', image: imageUrl },
          ],
        },
      ],
    });
    return parseAnalysis(result.text);
  } catch (error) {
    console.error('Failed to analyze brow tint style with AI:', error);
    return FALLBACK;
  }
}

/**
 * Same as analyzeBrowTintWithAI but takes raw base64 image data.
 */
export async function analyzeBrowTintFromBase64(
  base64Data: string,
  mimeType: string = 'image/png'
): Promise<BrowTintAnalysis> {
  const openrouter = await getOpenRouter();
  const model = openrouter.chat(VISION_MODEL);

  try {
    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_INSTRUCTION },
            {
              type: 'image',
              image: `data:${mimeType};base64,${base64Data}`,
            },
          ],
        },
      ],
    });
    return parseAnalysis(result.text);
  } catch (error) {
    console.error('Failed to analyze brow tint style with AI:', error);
    return FALLBACK;
  }
}
