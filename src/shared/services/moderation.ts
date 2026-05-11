import {
  CreemModerationProvider,
  ModerationCallArgs,
  ModerationError,
  ModerationResult,
} from '@/extensions/moderation';
import { Configs, getAllConfigs } from '@/shared/models/config';

export interface ModerationServiceArgs extends ModerationCallArgs {
  userId?: string;
}

/**
 * Centralized moderation entry point. Reads Creem credentials from the same
 * DB config keys the payment service uses (creem_api_key, creem_environment).
 *
 * Returns { decision: 'allow', skipped: true } when moderation is disabled
 * via the `moderation_enabled` config flag (default: enabled), or when no
 * Creem API key is configured — this lets local dev environments without a
 * Creem key still function. In production both values are required.
 *
 * Throws ModerationError on network/timeout/non-2xx from Creem. The caller
 * is responsible for fail-closed behavior (block the generation).
 */
export async function moderatePrompt(
  args: ModerationServiceArgs
): Promise<ModerationResult> {
  const configs = await getAllConfigs();
  return moderatePromptWithConfigs(args, configs);
}

export async function moderatePromptWithConfigs(
  args: ModerationServiceArgs,
  configs: Configs
): Promise<ModerationResult> {
  const enabled = configs.moderation_enabled !== 'false';
  const apiKey = configs.creem_api_key;

  if (!enabled || !apiKey) {
    const reason = !enabled ? 'flag disabled' : 'creem_api_key not configured';
    console.warn(
      `[moderation] skipped (${reason}) external_id=${args.externalId} user=${args.userId ?? 'anon'}`
    );
    return { decision: 'allow', skipped: true, externalId: args.externalId };
  }

  const provider = new CreemModerationProvider({
    apiKey,
    environment:
      configs.creem_environment === 'production' ? 'production' : 'sandbox',
  });

  const result = await provider.moderatePrompt({
    prompt: args.prompt,
    externalId: args.externalId,
  });

  console.log(
    `[moderation] decision=${result.decision} external_id=${args.externalId} user=${args.userId ?? 'anon'}`
  );

  return result;
}

export { ModerationError };
