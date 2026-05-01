import { and, eq } from 'drizzle-orm';

import { envConfigs } from '@/config';
import { browStyle } from '@/config/db/schema';
import { buildBrowStylePrompt } from '@/config/img-prompt';
import { db } from '@/core/db';
import { AIMediaType } from '@/extensions/ai';
import { getUuid } from '@/shared/lib/hash';
import { respData, respErr } from '@/shared/lib/resp';
import { createAITask, NewAITask } from '@/shared/models/ai_task';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';

// Every brow tint generation costs exactly 2 credits. This constant is
// authoritative — the per-row brow_style.credits column is ignored by the
// server. See docs/superpowers/specs/2026-04-30-fix-brow-tint-credit-cost-design.md.
const BROW_TINT_COST_CREDITS = 2;

const BROW_STYLE_IMAGE_MODELS = [
  'nano-banana-pro',
  'gpt-image-2-image-to-image',
];

export async function POST(request: Request) {
  try {
    let { provider, mediaType, model, prompt, options, scene, styleId } =
      await request.json();

    if (!provider || !mediaType || !model) {
      throw new Error('invalid params');
    }

    if (!prompt && !options) {
      throw new Error('prompt or options is required');
    }

    const clientPrompt = typeof prompt === 'string' ? prompt : '';
    let generationPrompt = clientPrompt;
    let generationOptions =
      options && typeof options === 'object' ? { ...options } : options;

    const aiService = await getAIService();

    // check generate type
    if (!aiService.getMediaTypes().includes(mediaType)) {
      throw new Error('invalid mediaType');
    }

    // check ai provider
    const aiProvider = aiService.getProvider(provider);
    if (!aiProvider) {
      throw new Error('invalid provider');
    }

    if (styleId) {
      if (mediaType !== AIMediaType.IMAGE || scene !== 'image-to-image') {
        throw new Error('styleId is only supported for image-to-image');
      }

      if (!BROW_STYLE_IMAGE_MODELS.includes(model)) {
        throw new Error('invalid model for styleId');
      }
    }

    // get current user
    const user = await getUserInfo();
    if (!user) {
      throw new Error('no auth, please sign in');
    }

    // todo: get cost credits from settings
    let costCredits = 2;

    if (mediaType === AIMediaType.IMAGE) {
      // generate image
      if (scene === 'image-to-image') {
        costCredits = 6;
      } else if (scene === 'text-to-image') {
        costCredits = 4;
      } else {
        throw new Error('invalid scene');
      }
    } else if (mediaType === AIMediaType.VIDEO) {
      // generate video
      if (scene === 'text-to-video') {
        costCredits = 6;
      } else if (scene === 'image-to-video') {
        costCredits = 15;
      } else if (scene === 'video-to-video') {
        costCredits = 10;
      } else {
        throw new Error('invalid scene');
      }
    } else if (mediaType === AIMediaType.MUSIC) {
      // generate music
      costCredits = 10;
      scene = 'text-to-music';
    } else {
      throw new Error('invalid mediaType');
    }

    if (styleId) {
      const [style] = await db()
        .select()
        .from(browStyle)
        .where(and(eq(browStyle.id, styleId), eq(browStyle.status, 'active')))
        .limit(1);

      if (!style) {
        throw new Error('invalid styleId');
      }

      const subjectImageCount = Array.isArray(generationOptions?.image_input)
        ? generationOptions.image_input.length
        : 0;

      costCredits = BROW_TINT_COST_CREDITS;
      generationPrompt = buildBrowStylePrompt({
        name: style.name,
        shade: style.shade,
        shape: style.shape,
        intensity: style.intensity,
        styledPrompt: style.prompt,
        userPrompt: clientPrompt,
        subjectImageCount,
      });
      generationOptions = {
        ...(generationOptions ?? {}),
        negative_prompt: style.negative ?? generationOptions?.negative_prompt,
      };
    }

    // check credits
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < costCredits) {
      throw new Error('insufficient credits');
    }

    const callbackUrl = `${envConfigs.app_url}/api/ai/notify/${provider}`;

    const params: any = {
      mediaType,
      model,
      prompt: generationPrompt,
      callbackUrl,
      options: generationOptions,
    };

    // generate content
    const result = await aiProvider.generate({ params });
    if (!result?.taskId) {
      throw new Error(
        `ai generate failed, mediaType: ${mediaType}, provider: ${provider}, model: ${model}`
      );
    }

    // create ai task
    const newAITask: NewAITask = {
      id: getUuid(),
      userId: user.id,
      mediaType,
      provider,
      model,
      prompt: clientPrompt,
      scene,
      options: generationOptions ? JSON.stringify(generationOptions) : null,
      status: result.taskStatus,
      costCredits,
      taskId: result.taskId,
      taskInfo: result.taskInfo ? JSON.stringify(result.taskInfo) : null,
      taskResult: result.taskResult ? JSON.stringify(result.taskResult) : null,
    };
    await createAITask(newAITask);

    return respData(newAITask);
  } catch (e: any) {
    console.log('generate failed', e);
    return respErr(e.message);
  }
}
