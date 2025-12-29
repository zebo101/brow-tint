import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

import { getAllConfigs } from '@/shared/models/config';

/**
 * Analyze a hairstyle image using OpenRouter Vision API
 * Returns AI-generated name and tags for the hairstyle
 */
export async function analyzeHairstyleWithAI(imageUrl: string): Promise<{
  name: string;
  tags: string[];
}> {
  const configs = await getAllConfigs();
  const openrouterApiKey = configs.openrouter_api_key;
  
  if (!openrouterApiKey) {
    throw new Error('openrouter_api_key is not set');
  }

  const openrouterBaseUrl = configs.openrouter_base_url;

  const openrouter = createOpenRouter({
    apiKey: openrouterApiKey,
    baseURL: openrouterBaseUrl || undefined,
  });

  // Use a vision-capable model
  const model = openrouter.chat('google/gemini-2.0-flash-exp:free');

  const prompt = `Analyze this hairstyle image and provide:
1. A short, descriptive name for this hairstyle (2-4 words, in English)
2. 3-5 relevant tags describing the style characteristics

Respond in JSON format only:
{
  "name": "Short Textured Fade",
  "tags": ["short", "textured", "fade", "modern", "casual"]
}`;

  try {
    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image', image: imageUrl },
          ],
        },
      ],
    });

    // Parse the JSON response
    const text = result.text.trim();
    // Extract JSON from potential markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Failed to parse AI response, using defaults:', text);
      return {
        name: 'Hairstyle',
        tags: ['hairstyle'],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name || 'Hairstyle',
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['hairstyle'],
    };
  } catch (error) {
    console.error('Failed to analyze hairstyle with AI:', error);
    return {
      name: 'Hairstyle',
      tags: ['hairstyle'],
    };
  }
}

/**
 * Analyze hairstyle from base64 image data
 */
export async function analyzeHairstyleFromBase64(
  base64Data: string,
  mimeType: string = 'image/png'
): Promise<{
  name: string;
  tags: string[];
}> {
  const configs = await getAllConfigs();
  const openrouterApiKey = configs.openrouter_api_key;
  
  if (!openrouterApiKey) {
    throw new Error('openrouter_api_key is not set');
  }

  const openrouterBaseUrl = configs.openrouter_base_url;

  const openrouter = createOpenRouter({
    apiKey: openrouterApiKey,
    baseURL: openrouterBaseUrl || undefined,
  });

  const model = openrouter.chat('google/gemini-2.0-flash-exp:free');

  const prompt = `Analyze this hairstyle image and provide:
1. A short, descriptive name for this hairstyle (2-4 words, in English)
2. 3-5 relevant tags describing the style characteristics

Respond in JSON format only:
{
  "name": "Short Textured Fade",
  "tags": ["short", "textured", "fade", "modern", "casual"]
}`;

  try {
    const result = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              image: `data:${mimeType};base64,${base64Data}`,
            },
          ],
        },
      ],
    });

    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Failed to parse AI response, using defaults:', text);
      return {
        name: 'Hairstyle',
        tags: ['hairstyle'],
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      name: parsed.name || 'Hairstyle',
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['hairstyle'],
    };
  } catch (error) {
    console.error('Failed to analyze hairstyle with AI:', error);
    return {
      name: 'Hairstyle',
      tags: ['hairstyle'],
    };
  }
}
