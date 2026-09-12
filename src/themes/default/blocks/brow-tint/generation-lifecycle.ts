import { BROW_IMAGE_MODEL, BROW_IMAGE_OPTIONS } from '@/config/brow-model';

export type GenerationPhase =
  | 'idle'
  | 'uploading'
  | 'submitting'
  | 'querying'
  | 'query-paused'
  | 'submit-ambiguous'
  | 'success'
  | 'failed';

export interface GenerationState {
  phase: GenerationPhase;
  taskId: string | null;
  resultUrl: string | null;
  message: string | null;
}

export const initialGenerationState: GenerationState = {
  phase: 'idle',
  taskId: null,
  resultUrl: null,
  message: null,
};

export type GenerationAction =
  | { type: 'upload-started' }
  | { type: 'upload-failed'; message: string }
  | { type: 'submit-started' }
  | { type: 'submit-ambiguous'; message: string }
  | { type: 'submit-failed'; message: string }
  | { type: 'task-accepted'; taskId: string }
  | { type: 'query-interrupted'; message: string }
  | { type: 'query-retried' }
  | { type: 'task-succeeded'; resultUrl: string }
  | { type: 'task-failed'; message: string }
  | { type: 'reset' };

export function isDesignLocked(state: GenerationState): boolean {
  return (
    state.phase === 'uploading' ||
    state.phase === 'submitting' ||
    state.phase === 'querying' ||
    state.phase === 'query-paused' ||
    state.phase === 'submit-ambiguous'
  );
}

export function validateBrowPhotoFile(file: {
  type: string;
  size: number;
}): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Please upload a JPG, PNG, or WebP image.';
  }
  if (file.size > 15 * 1024 * 1024) {
    return 'File must be under 15 MB.';
  }
  return null;
}

type GenerateResponse =
  | { kind: 'accepted'; taskId: string }
  | { kind: 'rejected'; message: string }
  | { kind: 'ambiguous'; message: string };

export function classifyGenerateResponse(
  status: number,
  body: unknown
): GenerateResponse {
  const payload =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const message =
    typeof payload.message === 'string'
      ? payload.message
      : 'Generation request failed.';

  if (status >= 500) return { kind: 'ambiguous', message };
  if (payload.submissionState === 'not-submitted') {
    return { kind: 'rejected', message };
  }
  if (status < 200 || status >= 300) return { kind: 'ambiguous', message };

  if (typeof payload.code === 'number' && payload.code !== 0) {
    return { kind: 'ambiguous', message };
  }

  const data =
    payload.data && typeof payload.data === 'object'
      ? (payload.data as Record<string, unknown>)
      : null;
  if (typeof data?.id === 'string' && data.id) {
    return { kind: 'accepted', taskId: data.id };
  }

  return {
    kind: 'ambiguous',
    message: 'The generation task response was incomplete.',
  };
}

export function generationReducer(
  state: GenerationState,
  action: GenerationAction
): GenerationState {
  switch (action.type) {
    case 'upload-started':
      if (isDesignLocked(state)) return state;
      return { ...initialGenerationState, phase: 'uploading' };
    case 'upload-failed':
    case 'submit-failed':
      return {
        phase: 'failed',
        taskId: null,
        resultUrl: null,
        message: action.message,
      };
    case 'submit-started':
      if (state.phase !== 'uploading') return state;
      return { ...state, phase: 'submitting', message: null };
    case 'submit-ambiguous':
      if (state.phase !== 'submitting') return state;
      return {
        phase: 'submit-ambiguous',
        taskId: null,
        resultUrl: null,
        message: action.message,
      };
    case 'task-accepted':
      if (state.phase !== 'submitting') return state;
      return {
        phase: 'querying',
        taskId: action.taskId,
        resultUrl: null,
        message: null,
      };
    case 'query-interrupted':
      if (state.phase !== 'querying' || !state.taskId) return state;
      return { ...state, phase: 'query-paused', message: action.message };
    case 'query-retried':
      if (state.phase !== 'query-paused' || !state.taskId) return state;
      return { ...state, phase: 'querying', message: null };
    case 'task-succeeded':
      if (state.phase !== 'querying') return state;
      return {
        ...state,
        phase: 'success',
        resultUrl: action.resultUrl,
        message: null,
      };
    case 'task-failed':
      if (state.phase !== 'querying') return state;
      return { ...state, phase: 'failed', message: action.message };
    case 'reset':
      return isDesignLocked(state) ? state : initialGenerationState;
  }
}

interface BrowMappingPayloadInput {
  styleId: string;
  originalUrl: string;
  guideUrl: string;
}

export function buildBrowMappingPayload({
  styleId,
  originalUrl,
  guideUrl,
}: BrowMappingPayloadInput) {
  if (!styleId.trim()) {
    throw new Error('A selected brow style is required.');
  }
  if (!originalUrl.trim() || !guideUrl.trim()) {
    throw new Error('Both uploaded images are required.');
  }

  return {
    provider: 'kie',
    mediaType: 'image',
    model: BROW_IMAGE_MODEL,
    scene: 'image-to-image',
    styleId,
    browMapping: true,
    options: { ...BROW_IMAGE_OPTIONS, image_input: [originalUrl, guideUrl] },
  } as const;
}
