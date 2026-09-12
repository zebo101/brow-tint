import { and, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { BROW_GENERATION_CREDITS } from '@/config/brow-pricing';
import { browStyle } from '@/config/db/schema';
import { buildBrowStylePrompt } from '@/config/img-prompt';
import { AIMediaType } from '@/extensions/ai';
import { serializeBrowTaskForClient } from '@/shared/lib/brow-export';
import {
  appendBrowMappingStyleReference,
  createGenerationError,
  validateBrowMappingRequest,
} from '@/shared/lib/brow-mapping/generation-contract';
import { getUuid } from '@/shared/lib/hash';
import { respData } from '@/shared/lib/resp';
import { createAITask, NewAITask } from '@/shared/models/ai_task';
import { getRemainingCredits } from '@/shared/models/credit';
import { getUserInfo } from '@/shared/models/user';
import { getAIService } from '@/shared/services/ai';
import { getBrowEntitlements } from '@/shared/services/brow-entitlements';
import { enqueueBrowGeneration } from '@/shared/services/brow-queue';
import { moderatePrompt } from '@/shared/services/moderation';
import { browShapeLabel } from '@/themes/default/blocks/brow-tint/shape-label';

// Every brow tint generation costs exactly 2 credits. This constant is
// authoritative — the per-row brow_style.credits column is ignored by the
// server. See docs/superpowers/specs/2026-04-30-fix-brow-tint-credit-cost-design.md.
const BROW_TINT_COST_CREDITS = BROW_GENERATION_CREDITS;

const BROW_STYLE_IMAGE_MODELS = [
  'nano-banana-pro',
  'gpt-image-2-image-to-image',
];

export async function POST(request: Request) {
  let providerSubmissionStarted = false;

  try {
    const requestBody = await request.json();
    const {
      provider,
      mediaType,
      model,
      prompt,
      options,
      styleId,
      browMapping,
    } = requestBody;
    let { scene } = requestBody;

    if (!provider || !mediaType || !model) {
      throw new Error('invalid params');
    }

    if (!prompt && !options) {
      throw new Error('prompt or options is required');
    }

    // Browlens exposes image generation only through validated brow styles.
    // Enforce the boundary by media type rather than attempting to enumerate
    // every provider's image-input fields. Video/music retain their APIs.
    const requiresBrowStyle =
      mediaType === AIMediaType.IMAGE ||
      BROW_STYLE_IMAGE_MODELS.includes(model);
    if (requiresBrowStyle && (typeof styleId !== 'string' || !styleId.trim())) {
      throw new Error('invalid styleId');
    }

    const clientPrompt = typeof prompt === 'string' ? prompt : '';
    let generationPrompt = clientPrompt;
    let generationOptions =
      options && typeof options === 'object' ? { ...options } : options;
    // Internal task metadata is always server-owned, including on non-brow requests.
    if (generationOptions && typeof generationOptions === 'object') {
      delete generationOptions.__browQueue;
      delete generationOptions.__browExport;
    }
    let browExportMetadata:
      | { styleId: string; styleName: string; source: string }
      | undefined;

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

    validateBrowMappingRequest({
      browMapping,
      styleId,
      mediaType,
      scene,
      model,
      supportedModels: BROW_STYLE_IMAGE_MODELS,
    });

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

      browExportMetadata = {
        styleId: style.id,
        styleName: browShapeLabel({ shape: style.shape }, 'en'),
        source:
          typeof generationOptions?.image_input?.[0] === 'string'
            ? generationOptions.image_input[0]
            : '',
      };

      if (browMapping === true) {
        generationOptions = appendBrowMappingStyleReference(
          generationOptions,
          style.thumbnail
        );
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
        browMapping: browMapping === true,
      });
      generationOptions = {
        ...(generationOptions ?? {}),
        negative_prompt: style.negative ?? generationOptions?.negative_prompt,
      };
    }

    // Creem compliance: every prompt routed to an image or video generation
    // model must be screened through /v1/moderation/prompt first. Music is
    // explicitly excluded per Creem's content-safety requirements docs.
    if (mediaType === AIMediaType.IMAGE || mediaType === AIMediaType.VIDEO) {
      const externalId = `user_${user.id}:gen_${getUuid()}`;
      let moderation;
      try {
        moderation = await moderatePrompt({
          prompt: generationPrompt,
          externalId,
          userId: user.id,
        });
      } catch (err) {
        console.error('[moderation] call failed, blocking generation', err);
        throw new Error('moderation_unavailable');
      }
      if (moderation.decision === 'deny' || moderation.decision === 'flag') {
        throw new Error('moderation_denied');
      }
    }

    // check credits
    const remainingCredits = await getRemainingCredits(user.id);
    if (remainingCredits < costCredits) {
      throw new Error('insufficient credits');
    }

    const callbackUrl = `${envConfigs.app_url}/api/ai/notify/${provider}`;

    const params = {
      mediaType,
      model,
      prompt: generationPrompt,
      callbackUrl,
      options: generationOptions,
    };

    if (styleId) {
      const entitlements = await getBrowEntitlements(user.id);
      const queued = await enqueueBrowGeneration(
        {
          id: getUuid(),
          userId: user.id,
          mediaType,
          provider,
          model,
          prompt: clientPrompt,
          scene,
          status: 'pending',
          costCredits,
          options: JSON.stringify({
            ...generationOptions,
            __browExport: browExportMetadata,
          }),
        },
        params,
        entitlements.queuePriority
      );
      return respData(serializeBrowTaskForClient(queued, entitlements));
    }

    // generate content
    providerSubmissionStarted = true;
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

    return respData(
      serializeBrowTaskForClient(newAITask, await getBrowEntitlements(user.id))
    );
  } catch (e) {
    const errorResponse = createGenerationError(e, providerSubmissionStarted);
    console.log('generate failed', errorResponse);
    return Response.json(errorResponse);
  }
}
