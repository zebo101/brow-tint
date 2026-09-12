type BrowMappingRequest = {
  browMapping: unknown;
  preserveBrowShape?: unknown;
  styleId: unknown;
  mediaType: unknown;
  scene: unknown;
  model: unknown;
  supportedModels: readonly string[];
};

export type GenerationSubmissionState = 'not-submitted' | 'unknown';

export type GenerationErrorResponse = {
  code: -1;
  message: string;
  submissionState: GenerationSubmissionState;
};

const PUBLIC_PRE_SUBMISSION_ERRORS = new Set([
  'invalid params',
  'preserveBrowShape must be a boolean and requires browMapping when enabled',
  'prompt or options is required',
  'invalid mediaType',
  'invalid provider',
  'browMapping requires an active style and a supported image-to-image model',
  'styleId is only supported for image-to-image',
  'invalid model for styleId',
  'no auth, please sign in',
  'invalid scene',
  'invalid styleId',
  'browMapping requires exactly two valid HTTP(S) image URLs',
  'browMapping does not accept additional provider image fields',
  'active brow style is missing a valid HTTP(S) thumbnail',
  'moderation_unavailable',
  'moderation_denied',
  'insufficient credits',
]);

export function createGenerationError(
  error: unknown,
  providerSubmissionStarted: boolean
): GenerationErrorResponse {
  if (providerSubmissionStarted) {
    return {
      code: -1,
      message:
        'Generation submission status is unknown. Check task history before retrying.',
      submissionState: 'unknown',
    };
  }

  const errorMessage = error instanceof Error ? error.message : '';
  return {
    code: -1,
    message: PUBLIC_PRE_SUBMISSION_ERRORS.has(errorMessage)
      ? errorMessage
      : 'Generation request failed.',
    submissionState: 'not-submitted',
  };
}

export function validateBrowMappingRequest({
  browMapping,
  preserveBrowShape,
  styleId,
  mediaType,
  scene,
  model,
  supportedModels,
}: BrowMappingRequest): void {
  if (
    (preserveBrowShape !== undefined &&
      typeof preserveBrowShape !== 'boolean') ||
    (preserveBrowShape === true && browMapping !== true)
  ) {
    throw new Error(
      'preserveBrowShape must be a boolean and requires browMapping when enabled'
    );
  }
  if (browMapping !== true) {
    return;
  }

  if (
    typeof styleId !== 'string' ||
    styleId.trim().length === 0 ||
    mediaType !== 'image' ||
    scene !== 'image-to-image' ||
    typeof model !== 'string' ||
    !supportedModels.includes(model)
  ) {
    throw new Error(
      'browMapping requires an active style and a supported image-to-image model'
    );
  }
}

export function appendBrowMappingStyleReference(
  options: unknown,
  styleThumbnail: unknown
): Record<string, unknown> {
  if (!isRecord(options)) {
    throw new Error(
      'browMapping requires exactly two valid HTTP(S) image URLs'
    );
  }

  const imageInput = options.image_input;
  if (
    !Array.isArray(imageInput) ||
    imageInput.length !== 2 ||
    !imageInput.every(isHttpUrl)
  ) {
    throw new Error(
      'browMapping requires exactly two valid HTTP(S) image URLs'
    );
  }

  if (
    ['input_urls', 'image_urls', 'brow_tint_image'].some((field) =>
      Object.prototype.hasOwnProperty.call(options, field)
    )
  ) {
    throw new Error(
      'browMapping does not accept additional provider image fields'
    );
  }

  if (!isHttpUrl(styleThumbnail)) {
    throw new Error('active brow style is missing a valid HTTP(S) thumbnail');
  }

  return {
    ...options,
    image_input: [imageInput[0], imageInput[1], styleThumbnail],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}
