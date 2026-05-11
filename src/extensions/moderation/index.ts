export type ModerationDecision = 'allow' | 'flag' | 'deny';

export interface ModerationResult {
  decision: ModerationDecision;
  id?: string;
  externalId?: string;
  units?: number;
  raw?: unknown;
  skipped?: boolean;
}

export interface ModerationCallArgs {
  prompt: string;
  externalId: string;
}

export interface ModerationProvider {
  readonly name: string;
  moderatePrompt(args: ModerationCallArgs): Promise<ModerationResult>;
}

export class ModerationError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ModerationError';
    this.cause = cause;
  }
}

export * from './creem';
