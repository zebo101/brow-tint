export type ImageGeneratorTab = 'text-to-image' | 'image-to-image';

export type ImageModelOption = {
  value: string;
  label: string;
  provider: string;
  scenes: ImageGeneratorTab[];
};

export const MODEL_OPTIONS: ImageModelOption[] = [
  {
    value: 'google/nano-banana-pro',
    label: 'Nano Banana Pro',
    provider: 'replicate',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'bytedance/seedream-4',
    label: 'Seedream 4',
    provider: 'replicate',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'fal-ai/nano-banana-pro',
    label: 'Nano Banana Pro',
    provider: 'fal',
    scenes: ['text-to-image'],
  },
  {
    value: 'fal-ai/nano-banana-pro/edit',
    label: 'Nano Banana Pro',
    provider: 'fal',
    scenes: ['image-to-image'],
  },
  {
    value: 'fal-ai/bytedance/seedream/v4/edit',
    label: 'Seedream 4',
    provider: 'fal',
    scenes: ['image-to-image'],
  },
  {
    value: 'fal-ai/z-image/turbo',
    label: 'Z-Image Turbo',
    provider: 'fal',
    scenes: ['text-to-image'],
  },
  {
    value: 'fal-ai/flux-2-flex',
    label: 'Flux 2 Flex',
    provider: 'fal',
    scenes: ['text-to-image'],
  },
  {
    value: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image Preview',
    provider: 'gemini',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'nano-banana-pro',
    label: 'Nano Banana Pro',
    provider: 'kie',
    scenes: ['text-to-image', 'image-to-image'],
  },
  {
    value: 'gpt-image-2-text-to-image',
    label: 'GPT Image 2',
    provider: 'kie',
    scenes: ['text-to-image'],
  },
  {
    value: 'gpt-image-2-image-to-image',
    label: 'GPT Image 2',
    provider: 'kie',
    scenes: ['image-to-image'],
  },
];

export function getPreferredImageModel({
  activeTab,
  provider,
}: {
  activeTab: ImageGeneratorTab;
  provider: string;
}): string {
  const availableModels = MODEL_OPTIONS.filter(
    (option) => option.scenes.includes(activeTab) && option.provider === provider
  );

  if (provider === 'kie') {
    const preferredKieModel =
      activeTab === 'text-to-image'
        ? 'gpt-image-2-text-to-image'
        : 'gpt-image-2-image-to-image';

    if (availableModels.some((option) => option.value === preferredKieModel)) {
      return preferredKieModel;
    }
  }

  return availableModels[0]?.value ?? '';
}

export function getImageModelSelectValue(model: string): string {
  return model.startsWith('gpt-image-2') ? 'gpt-image-2' : model;
}

export function resolveImageModelSelection({
  activeTab,
  value,
}: {
  activeTab: ImageGeneratorTab;
  value: string;
}): string {
  if (value !== 'gpt-image-2') {
    return value;
  }

  return activeTab === 'text-to-image'
    ? 'gpt-image-2-text-to-image'
    : 'gpt-image-2-image-to-image';
}
