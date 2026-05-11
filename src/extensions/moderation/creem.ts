import {
  ModerationCallArgs,
  ModerationDecision,
  ModerationError,
  ModerationProvider,
  ModerationResult,
} from './index';

export interface CreemModerationConfigs {
  apiKey: string;
  environment?: 'sandbox' | 'production';
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 5000;

const VALID_DECISIONS: ReadonlyArray<ModerationDecision> = [
  'allow',
  'flag',
  'deny',
];

export class CreemModerationProvider implements ModerationProvider {
  readonly name = 'creem';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(configs: CreemModerationConfigs) {
    if (!configs.apiKey) {
      throw new ModerationError('Creem moderation apiKey is required');
    }
    this.apiKey = configs.apiKey;
    this.baseUrl =
      configs.environment === 'production'
        ? 'https://api.creem.io'
        : 'https://test-api.creem.io';
    this.timeoutMs = configs.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = configs.fetchImpl ?? fetch;
  }

  async moderatePrompt(args: ModerationCallArgs): Promise<ModerationResult> {
    if (!args.prompt) {
      throw new ModerationError('prompt is required');
    }
    if (!args.externalId) {
      throw new ModerationError('externalId is required');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v1/moderation/prompt`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: args.prompt,
          external_id: args.externalId,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new ModerationError(
          `Creem moderation request timed out after ${this.timeoutMs}ms`,
          err
        );
      }
      throw new ModerationError(
        `Creem moderation request failed: ${err?.message ?? 'unknown error'}`,
        err
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new ModerationError(
        `Creem moderation API returned status ${response.status}`
      );
    }

    let body: any;
    try {
      body = await response.json();
    } catch (err: any) {
      throw new ModerationError(
        `Creem moderation response was not valid JSON: ${err?.message ?? ''}`,
        err
      );
    }

    const decision = body?.decision;
    if (!VALID_DECISIONS.includes(decision)) {
      throw new ModerationError(
        `Creem moderation response missing or invalid decision: ${JSON.stringify(
          body
        )}`
      );
    }

    return {
      decision,
      id: typeof body.id === 'string' ? body.id : undefined,
      externalId:
        typeof body.external_id === 'string' ? body.external_id : args.externalId,
      units:
        typeof body?.usage?.units === 'number' ? body.usage.units : undefined,
      raw: body,
    };
  }
}

export function createCreemModerationProvider(
  configs: CreemModerationConfigs
): CreemModerationProvider {
  return new CreemModerationProvider(configs);
}
