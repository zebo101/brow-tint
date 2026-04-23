'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  CreditCard,
  Download,
  ImageIcon,
  ImagePlus,
  Loader2,
  PanelLeft,
  PanelRight,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link } from '@/core/i18n/navigation';
import {
  buildHairstylePrompt,
  HAIRSTYLE_NEGATIVE_PROMPT,
} from '@/config/img-prompt';
import { AIMediaType, AITaskStatus } from '@/extensions/ai/types';
import {
  ImageDropzone,
  ImageUploader,
  ImageUploaderValue,
  LazyImage,
} from '@/shared/blocks/common';
import { HairstyleCategorySelector } from '@/shared/components/hairstyle-category-selector';
import { StackedHairstyleCards } from '@/shared/components/stacked-hairstyle-cards';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppContext } from '@/shared/contexts/app';
import { useHairstyles } from '@/shared/hooks/use-hairstyles';
import { cn } from '@/shared/lib/utils';
import {
  getImageModelSelectValue,
  getPreferredImageModel,
  MODEL_OPTIONS,
  resolveImageModelSelection,
  type ImageGeneratorTab,
} from './image-models';

interface ImageGeneratorProps {
  allowMultipleImages?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  srOnlyTitle?: string;
  className?: string;
  historyImages?: GeneratedImage[];
}

interface GeneratedImage {
  id: string;
  url: string;
  provider?: string;
  model?: string;
  prompt?: string;
  taskId?: string;
  createdAt?: string;
}

interface BackendTask {
  id: string;
  status: string;
  provider: string;
  model: string;
  prompt: string | null;
  taskInfo: string | null;
  taskResult: string | null;
}

const POLL_INTERVAL = 5000;
const GENERATION_TIMEOUT = 180000;
const MAX_POLL_ERRORS = 3;
const MAX_PROMPT_LENGTH = 2000;
const MAX_HISTORY_IMAGES = 24;

const EXAMPLE_STACK_ITEMS = [
  { id: 'example-11', src: '/imgs/cases/11.png', alt: 'Example hairstyle' },
];
const EXAMPLE_MAIN_IMAGE = EXAMPLE_STACK_ITEMS[0];

type HairstyleCategoryKey = 'men' | 'women' | 'boys' | 'girls';

type HairstyleCategory = {
  key: HairstyleCategoryKey;
  count: number;
};

// Database hairstyle type
interface Hairstyle {
  id: string;
  category: string;
  sequence: number;
  name: string;
  tags: string[];
  description?: string;
  prompt?: string;
  imageUrl: string;
  thumbnailUrl: string;
}

// Fallback hardcoded categories (used when API fails or no data)
const FALLBACK_CATEGORIES: HairstyleCategory[] = [
  { key: 'men', count: 12 },
  { key: 'women', count: 12 },
  { key: 'boys', count: 12 },
  { key: 'girls', count: 12 },
];

const PROVIDER_OPTIONS = [
  {
    value: 'replicate',
    label: 'Replicate',
  },
  {
    value: 'fal',
    label: 'Fal',
  },
  {
    value: 'gemini',
    label: 'Gemini',
  },
  {
    value: 'kie',
    label: 'Kie',
  },
];

function parseTaskResult(taskResult: string | null): any {
  if (!taskResult) {
    return null;
  }

  try {
    return JSON.parse(taskResult);
  } catch (error) {
    console.warn('Failed to parse taskResult:', error);
    return null;
  }
}

function extractImageUrls(result: any): string[] {
  if (!result) {
    return [];
  }

  const output = result.output ?? result.images ?? result.data;

  if (!output) {
    return [];
  }

  if (typeof output === 'string') {
    return [output];
  }

  if (Array.isArray(output)) {
    return output
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === 'string') return [item];
        if (typeof item === 'object') {
          const candidate =
            item.url ?? item.uri ?? item.image ?? item.src ?? item.imageUrl;
          return typeof candidate === 'string' ? [candidate] : [];
        }
        return [];
      })
      .filter(Boolean);
  }

  if (typeof output === 'object') {
    const candidate =
      output.url ?? output.uri ?? output.image ?? output.src ?? output.imageUrl;
    if (typeof candidate === 'string') {
      return [candidate];
    }
  }

  return [];
}

function mergeUniqueImages(
  existingImages: GeneratedImage[],
  incomingImages: GeneratedImage[],
  limit = MAX_HISTORY_IMAGES
): GeneratedImage[] {
  const seen = new Set<string>();

  return [...incomingImages, ...existingImages]
    .filter((image) => {
      if (!image.url) {
        return false;
      }

      const key = `${image.taskId ?? image.id}::${image.url}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function ImageGenerator({
  allowMultipleImages = true,
  maxImages = 8,
  maxSizeMB = 5,
  srOnlyTitle,
  className,
  historyImages = [],
}: ImageGeneratorProps) {
  const t = useTranslations('ai.image.generator');

  const [activeTab, setActiveTab] =
    useState<ImageGeneratorTab>('image-to-image');

  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'history' | 'discover'>('discover');
  const [isLeftSheetOpen, setIsLeftSheetOpen] = useState(false);
  const [selectedHairstyleName, setSelectedHairstyleName] = useState<
    string | null
  >(null);
  const [selectedHairstyle, setSelectedHairstyle] = useState<Hairstyle | null>(
    null
  );

  const [costCredits, setCostCredits] = useState<number>(6);
  const [provider, setProvider] = useState(PROVIDER_OPTIONS[3]?.value ?? 'kie');
  const [model, setModel] = useState(() =>
    getPreferredImageModel({
      activeTab: 'image-to-image',
      provider: PROVIDER_OPTIONS[3]?.value ?? 'kie',
    })
  );
  const [prompt, setPrompt] = useState('');
  const [referenceImageItems, setReferenceImageItems] = useState<
    ImageUploaderValue[]
  >([]);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [historyPanelImages, setHistoryPanelImages] =
    useState<GeneratedImage[]>(historyImages);
  const [selectedPreviewImage, setSelectedPreviewImage] =
    useState<GeneratedImage | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(
    null
  );
  const [taskStatus, setTaskStatus] = useState<AITaskStatus | null>(null);
  const [downloadingImageId, setDownloadingImageId] = useState<string | null>(
    null
  );
  const [pollErrorCount, setPollErrorCount] = useState(0);
  const pollErrorCountRef = useRef(0);
  const [isMounted, setIsMounted] = useState(false);
  const [showExampleImage, setShowExampleImage] = useState(true);

  // Dynamic hairstyles from cached hook
  const {
    hairstyles,
    categories: categoryData,
    isLoading: isLoadingHairstyles,
  } = useHairstyles();

  // Disambiguate the selected hairstyle's name when the same `name` appears
  // on more than one row in its category (can happen because the AI analyzer
  // sometimes gives visually-similar cuts identical names).
  const selectedDisplayName = useMemo(() => {
    if (!selectedHairstyle) return '';
    const siblings = hairstyles[selectedHairstyle.category] ?? [];
    const sameName = siblings.filter((h) => h.name === selectedHairstyle.name);
    if (sameName.length <= 1) return selectedHairstyle.name;
    const idx = sameName.findIndex((h) => h.id === selectedHairstyle.id) + 1;
    return `${selectedHairstyle.name} #${idx}`;
  }, [hairstyles, selectedHairstyle]);

  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setHistoryPanelImages(historyImages);
  }, [historyImages]);

  const promptLength = prompt.trim().length;
  const remainingCredits = user?.credits?.remainingCredits ?? 0;
  const isPromptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const isTextToImageMode = activeTab === 'text-to-image';

  const handleTabChange = (value: string) => {
    const tab = value as ImageGeneratorTab;
    setActiveTab(tab);
    setModel(
      getPreferredImageModel({
        activeTab: tab,
        provider,
      })
    );

    if (tab === 'text-to-image') {
      setCostCredits(4);
    } else {
      setCostCredits(6);
    }
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    setModel(
      getPreferredImageModel({
        activeTab,
        provider: value,
      })
    );
  };

  const taskStatusLabel = useMemo(() => {
    if (!taskStatus) {
      return '';
    }

    switch (taskStatus) {
      case AITaskStatus.PENDING:
        return 'Waiting for the model to start';
      case AITaskStatus.PROCESSING:
        return 'Generating your image...';
      case AITaskStatus.SUCCESS:
        return 'Image generation completed';
      case AITaskStatus.FAILED:
        return 'Generation failed';
      default:
        return '';
    }
  }, [taskStatus]);

  const handleReferenceImagesChange = useCallback(
    (items: ImageUploaderValue[]) => {
      setReferenceImageItems(items);
      const uploadedUrls = items
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);
      setReferenceImageUrls(uploadedUrls);
    },
    []
  );

  const isReferenceUploading = useMemo(
    () => referenceImageItems.some((item) => item.status === 'uploading'),
    [referenceImageItems]
  );

  const hasReferenceUploadError = useMemo(
    () => referenceImageItems.some((item) => item.status === 'error'),
    [referenceImageItems]
  );

  const syncGeneratedImagesToHistory = useCallback(
    (images: GeneratedImage[]) => {
      if (!user || images.length === 0) {
        return;
      }

      setHistoryPanelImages((prev) => mergeUniqueImages(prev, images));
    },
    [user]
  );

  const resetPollErrorCount = useCallback(() => {
    pollErrorCountRef.current = 0;
    setPollErrorCount(0);
  }, []);

  const resetTaskState = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setTaskId(null);
    setGenerationStartTime(null);
    setTaskStatus(null);
    resetPollErrorCount();
  }, [resetPollErrorCount]);

  const pollTaskStatus = useCallback(
    async (id: string) => {
      try {
        if (
          generationStartTime &&
          Date.now() - generationStartTime > GENERATION_TIMEOUT
        ) {
          resetTaskState();
          toast.error('Image generation timed out. Please try again.');
          return true;
        }

        const resp = await fetch('/api/ai/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ taskId: id }),
        });

        if (!resp.ok) {
          throw new Error(`request failed with status: ${resp.status}`);
        }

        const { code, message, data } = await resp.json();
        if (code !== 0) {
          throw new Error(message || 'Query task failed');
        }

        if (pollErrorCountRef.current > 0) {
          resetPollErrorCount();
        }

        const task = data as BackendTask;
        const currentStatus = task.status as AITaskStatus;
        setTaskStatus(currentStatus);

        const parsedResult = parseTaskResult(task.taskInfo);
        const imageUrls = extractImageUrls(parsedResult);

        if (currentStatus === AITaskStatus.PENDING) {
          setProgress((prev) => Math.max(prev, 20));
          return false;
        }

        if (currentStatus === AITaskStatus.PROCESSING) {
          if (imageUrls.length > 0) {
            setGeneratedImages(
              imageUrls.map((url, index) => ({
                id: `${task.id}-${index}`,
                url,
                provider: task.provider,
                model: task.model,
                prompt: task.prompt ?? undefined,
              }))
            );
            setProgress((prev) => Math.max(prev, 85));
          } else {
            setProgress((prev) => Math.min(prev + 10, 80));
          }
          return false;
        }

        if (currentStatus === AITaskStatus.SUCCESS) {
          if (imageUrls.length === 0) {
            toast.error('The provider returned no images. Please retry.');
          } else {
            const nextGeneratedImages = imageUrls.map((url, index) => ({
              id: `${task.id}-${index}`,
              taskId: task.id,
              url,
              provider: task.provider,
              model: task.model,
              prompt: task.prompt ?? undefined,
            }));

            setGeneratedImages(nextGeneratedImages);
            syncGeneratedImagesToHistory(nextGeneratedImages);
            toast.success('Image generated successfully');
          }

          setProgress(100);
          resetTaskState();
          return true;
        }

        if (currentStatus === AITaskStatus.FAILED) {
          const errorMessage =
            parsedResult?.errorMessage || 'Generate image failed';
          toast.error(errorMessage);
          resetTaskState();

          fetchUserCredits();

          return true;
        }

        setProgress((prev) => Math.min(prev + 5, 95));
        return false;
      } catch (error: any) {
        console.error('Error polling image task:', error);
        const nextPollErrorCount = pollErrorCountRef.current + 1;
        pollErrorCountRef.current = nextPollErrorCount;
        setPollErrorCount(nextPollErrorCount);

        if (nextPollErrorCount >= MAX_POLL_ERRORS) {
          toast.error(`Query task failed: ${error.message}`);
          resetTaskState();
          fetchUserCredits();
          return true;
        }

        return false;
      }
    },
    [
      generationStartTime,
      resetTaskState,
      fetchUserCredits,
      resetPollErrorCount,
      syncGeneratedImagesToHistory,
    ]
  );

  useEffect(() => {
    if (!taskId || !isGenerating) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (!taskId) {
        return;
      }
      const completed = await pollTaskStatus(taskId);
      if (completed) {
        cancelled = true;
      }
    };

    tick();

    const interval = setInterval(async () => {
      if (cancelled || !taskId) {
        clearInterval(interval);
        return;
      }
      const completed = await pollTaskStatus(taskId);
      if (completed) {
        clearInterval(interval);
      }
    }, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [taskId, isGenerating, pollTaskStatus]);

  // Smooth progress animation - increment progress slowly during generation
  useEffect(() => {
    if (!isGenerating || progress >= 90) {
      return;
    }

    const smoothInterval = setInterval(() => {
      setProgress((prev) => {
        // Slow down as we approach 90%
        const increment = prev < 50 ? 2 : prev < 70 ? 1 : 0.5;
        return Math.min(prev + increment, 90);
      });
    }, 1000);

    return () => clearInterval(smoothInterval);
  }, [isGenerating, progress]);

  const handleGenerate = async () => {
    if (!user) {
      setIsShowSignModal(true);
      return;
    }

    if (remainingCredits < costCredits) {
      toast.error('Insufficient credits. Please top up to keep creating.');
      return;
    }

    const trimmedPrompt = prompt.trim();
    const subjectImageCount = isTextToImageMode ? 0 : referenceImageUrls.length;

    // Construct the final prompt including hairstyle info if selected
    let finalPrompt = trimmedPrompt;
    if (selectedHairstyle) {
      const tags = Array.isArray(selectedHairstyle.tags)
        ? selectedHairstyle.tags
        : [];
      finalPrompt = buildHairstylePrompt(
        selectedHairstyle.name,
        tags,
        trimmedPrompt,
        subjectImageCount,
        selectedHairstyle.prompt || ''
      );
    }

    if (!finalPrompt) {
      toast.error(
        'Please enter a prompt or select a hairstyle before generating.'
      );
      return;
    }

    if (!provider || !model) {
      toast.error('Provider or model is not configured correctly.');
      return;
    }

    if (!isTextToImageMode && referenceImageUrls.length === 0) {
      toast.error('Please upload reference images before generating.');
      return;
    }

    setIsGenerating(true);
    setProgress(15);
    setTaskStatus(AITaskStatus.PENDING);
    setGeneratedImages([]);
    setGenerationStartTime(Date.now());
    resetPollErrorCount();

    try {
      const options: any = {};

      if (!isTextToImageMode) {
        options.image_input = referenceImageUrls;
      }

      // Only send hairstyle reference image when user photo exists (image-to-image)
      if (selectedHairstyle && !isTextToImageMode) {
        options.hairstyle_image = selectedHairstyle.imageUrl;
        options.negative_prompt = HAIRSTYLE_NEGATIVE_PROMPT;
      }

      const resp = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mediaType: AIMediaType.IMAGE,
          scene: isTextToImageMode ? 'text-to-image' : 'image-to-image',
          provider,
          model,
          prompt: finalPrompt,
          options,
        }),
      });

      if (!resp.ok) {
        throw new Error(`request failed with status: ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message || 'Failed to create an image task');
      }

      const newTaskId = data?.id;
      if (!newTaskId) {
        throw new Error('Task id missing in response');
      }

      if (data.status === AITaskStatus.SUCCESS && data.taskInfo) {
        const parsedResult = parseTaskResult(data.taskInfo);
        const imageUrls = extractImageUrls(parsedResult);

        if (imageUrls.length > 0) {
          const nextGeneratedImages = imageUrls.map((url, index) => ({
            id: `${newTaskId}-${index}`,
            taskId: newTaskId,
            url,
            provider,
            model,
            prompt: finalPrompt,
            createdAt: new Date().toISOString(),
          }));

          setGeneratedImages(nextGeneratedImages);
          syncGeneratedImagesToHistory(nextGeneratedImages);
          toast.success('Image generated successfully');
          setProgress(100);
          resetTaskState();
          await fetchUserCredits();
          return;
        }
      }

      setTaskId(newTaskId);
      setProgress(25);

      await fetchUserCredits();
    } catch (error: any) {
      console.error('Failed to generate image:', error);
      toast.error(`Failed to generate image: ${error.message}`);
      resetTaskState();
    }
  };

  const handleDownloadImage = async (image: GeneratedImage) => {
    if (!image.url) {
      return;
    }

    try {
      setDownloadingImageId(image.id);

      // Check if URL is local (starts with /) or external
      const isLocalUrl = image.url.startsWith('/');
      const fetchUrl = isLocalUrl
        ? image.url
        : `/api/proxy/file?url=${encodeURIComponent(image.url)}`;

      const resp = await fetch(fetchUrl);
      if (!resp.ok) {
        throw new Error('Failed to fetch image');
      }

      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 200);
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Failed to download image');
    } finally {
      setDownloadingImageId(null);
    }
  };

  const handleUseAsReference = async (image: GeneratedImage) => {
    if (!image.url) {
      return;
    }

    try {
      // Create ImageUploaderValue format with correct properties
      const newRefItem: ImageUploaderValue = {
        id: `ref-${image.id}`,
        preview: image.url,
        url: image.url,
        status: 'uploaded',
      };

      // Set as the only reference image
      setReferenceImageItems([newRefItem]);
      setReferenceImageUrls([image.url]);
    } catch (error) {
      console.error('Failed to set as reference:', error);
      toast.error('Failed to set as reference');
    }
  };

  return (
    <section
      className={cn(
        'relative overflow-hidden py-4 md:py-8 lg:py-12',
        className
      )}
    >
      {/* Atmosphere Background */}
      <div className="from-primary/5 via-background to-background absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] bg-[size:24px_24px]" />

      {srOnlyTitle && <h2 className="sr-only">{srOnlyTitle}</h2>}
      <div className="container px-4">
        <div
          className={cn(
            'relative mx-auto grid max-w-[1440px] items-stretch gap-6 lg:gap-10',
            'grid-cols-1 lg:justify-center',
            isLeftPanelOpen &&
              isRightPanelOpen &&
              'lg:grid-cols-[320px_minmax(400px,500px)_380px]',
            isLeftPanelOpen &&
              !isRightPanelOpen &&
              'lg:grid-cols-[320px_minmax(400px,500px)]',
            !isLeftPanelOpen &&
              isRightPanelOpen &&
              'lg:grid-cols-[minmax(400px,500px)_380px]',
            !isLeftPanelOpen &&
              !isRightPanelOpen &&
              'lg:grid-cols-[minmax(400px,500px)]'
          )}
        >
          {/* 左侧发型选择面板 - 桌面端 (紧凑下拉式) */}
          {isLeftPanelOpen && (
            <aside className="border-border/40 bg-card/40 hidden h-full flex-col overflow-hidden rounded-3xl border shadow-xl backdrop-blur-xl transition-all duration-300 lg:flex">
              <div className="shrink-0 border-b p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('categories.title')}</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsLeftPanelOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-4">
                <HairstyleCategorySelector
                  hairstyles={hairstyles}
                  categories={categoryData}
                  isLoading={isLoadingHairstyles}
                  selectedHairstyle={selectedHairstyle}
                  onSelect={(hairstyle: Hairstyle) => {
                    setSelectedHairstyle(hairstyle);
                    setSelectedHairstyleName(hairstyle.name);
                  }}
                />
              </div>
            </aside>
          )}

          {/* 移动端：从底部滑入的发型选择 Sheet */}
          <Sheet open={isLeftSheetOpen} onOpenChange={setIsLeftSheetOpen}>
            <SheetContent
              side="bottom"
              className="h-[85vh] max-h-[85vh] rounded-t-2xl p-0"
            >
              <div className="flex h-full flex-col">
                <div
                  className="bg-border mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full"
                  aria-hidden
                />
                <SheetHeader className="shrink-0 border-b p-4">
                  <SheetTitle>{t('categories.title')}</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-auto p-4">
                  <HairstyleCategorySelector
                    hairstyles={hairstyles}
                    categories={categoryData}
                    isLoading={isLoadingHairstyles}
                    selectedHairstyle={selectedHairstyle}
                    onSelect={(hairstyle: Hairstyle) => {
                      setSelectedHairstyle(hairstyle);
                      setSelectedHairstyleName(hairstyle.name);
                      setIsLeftSheetOpen(false);
                    }}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* 中间主区域 */}
          <main className="flex h-full min-w-0 flex-1 flex-col space-y-4 md:space-y-6">
            <Card className="border-border/40 bg-card/40 flex h-full flex-1 flex-col rounded-3xl shadow-xl backdrop-blur-xl transition-all duration-300">
              <CardContent className="flex flex-1 flex-col space-y-4 p-4 md:space-y-6 md:p-6">
                {/* 侧边栏展开按钮 - 桌面端 */}
                <div className="-mt-2 mb-2 hidden items-center justify-between lg:flex">
                  {!isLeftPanelOpen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLeftPanelOpen(true)}
                      className="text-muted-foreground hover:text-foreground gap-1"
                    >
                      <PanelLeft className="h-4 w-4" />
                      <span className="text-xs">{t('categories.title')}</span>
                    </Button>
                  ) : (
                    <div />
                  )}
                  {!isRightPanelOpen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRightPanelOpen(true)}
                      className="text-muted-foreground hover:text-foreground gap-1"
                    >
                      <span className="text-xs">
                        {rightTab === 'history'
                          ? t('sidebar.history')
                          : t('sidebar.discover')}
                      </span>
                      <PanelRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>
                {/* 发型选择入口 - 仅移动端显示 */}
                <div className="lg:hidden">
                  <button
                    type="button"
                    onClick={() => setIsLeftSheetOpen(true)}
                    className={cn(
                      'group border-border/70 bg-background/80 hover:border-primary/30 hover:bg-accent/50 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-all duration-200 hover:shadow-md',
                      selectedHairstyle && 'border-primary/50 bg-primary/[0.04]'
                    )}
                    aria-label={t('form.select_hairstyle_placeholder')}
                  >
                    {selectedHairstyle ? (
                      <img
                        src={selectedHairstyle.thumbnailUrl || undefined}
                        alt={selectedHairstyle.name}
                        className="border-border/60 bg-background h-11 w-11 flex-shrink-0 rounded-lg border object-cover shadow-sm dark:bg-gradient-to-b dark:from-white/45 dark:to-white/20"
                      />
                    ) : (
                      <div className="from-primary/20 to-primary/5 text-primary flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm font-medium',
                          selectedHairstyle
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {selectedHairstyle
                          ? selectedDisplayName
                          : t('form.select_hairstyle_placeholder')}
                      </p>
                      <p className="text-muted-foreground/90 mt-0.5 truncate text-xs">
                        {selectedHairstyle
                          ? t(`categories.${selectedHairstyle.category}`)
                          : t('categories.title')}
                      </p>
                    </div>
                    <ChevronRight className="text-muted-foreground/80 h-4 w-4 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                </div>

                {/* 多图上传区 */}
                <ImageUploader
                  title={t('form.reference_image')}
                  allowMultiple={allowMultipleImages}
                  maxImages={maxImages}
                  maxSizeMB={maxSizeMB}
                  uploadLabel={t('form.upload')}
                  emptyUploadLabel={t('form.upload_hint')}
                  maxSizeLabel={t('form.max_size')}
                  defaultPreviews={referenceImageUrls}
                  onChange={handleReferenceImagesChange}
                  showGuidelines={true}
                  enableCrop={true}
                />

                {hasReferenceUploadError && (
                  <p className="text-destructive text-xs">
                    {t('form.some_images_failed_to_upload')}
                  </p>
                )}

                {/* AI服务商和模型选择 - Hidden by default */}
                {/* <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('form.provider')}</Label>
                    <Select
                      value={provider}
                      onValueChange={handleProviderChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('form.select_provider')} />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('form.model')}</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('form.select_model')} />
                      </SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.filter(
                          (option) =>
                            option.scenes.includes(activeTab) &&
                            option.provider === provider
                        ).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div> */}

                {/* 模型选择 */}
                <div className="space-y-2">
                  <Label htmlFor="image-model" className="text-xs sm:text-sm">
                    {t('form.model')}
                  </Label>
                  <Select
                    value={getImageModelSelectValue(model)}
                    onValueChange={(value) =>
                      setModel(
                        resolveImageModelSelection({
                          activeTab,
                          value,
                        })
                      )
                    }
                  >
                    <SelectTrigger
                      id="image-model"
                      className="w-full text-xs sm:text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nano-banana-pro">
                        Nano Banana Pro
                      </SelectItem>
                      <SelectItem value="gpt-image-2">
                        GPT Image 2
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* AI发型描述 */}
                <div className="space-y-2">
                  <Label htmlFor="image-prompt" className="text-xs sm:text-sm">
                    {t('form.prompt')}
                  </Label>
                  <Textarea
                    id="image-prompt"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                    }}
                    placeholder={t('form.prompt_placeholder')}
                    className="min-h-32 text-xs sm:text-sm"
                  />
                  <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <span>
                      {promptLength} / {MAX_PROMPT_LENGTH}
                    </span>
                    {isPromptTooLong && (
                      <span className="text-destructive">
                        {t('form.prompt_too_long')}
                      </span>
                    )}
                  </div>
                </div>

                {/* 生成按钮 */}
                {!isMounted ? (
                  <Button
                    className="w-full text-xs sm:text-sm"
                    disabled
                    size="lg"
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('loading')}
                  </Button>
                ) : isCheckSign ? (
                  <Button
                    className="w-full text-xs sm:text-sm"
                    disabled
                    size="lg"
                  >
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('checking_account')}
                  </Button>
                ) : user ? (
                  <Button
                    size="lg"
                    className="w-full text-xs sm:text-sm"
                    onClick={handleGenerate}
                    disabled={
                      isGenerating ||
                      (!prompt.trim() && !selectedHairstyle) ||
                      isPromptTooLong ||
                      isReferenceUploading ||
                      hasReferenceUploadError
                    }
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('generating')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        {t('generate')}
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full text-xs sm:text-sm"
                    onClick={() => setIsShowSignModal(true)}
                  >
                    <User className="mr-2 h-4 w-4" />
                    {t('sign_in_to_generate')}
                  </Button>
                )}

                {/* 积分消耗显示 */}
                {!isMounted ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <span>{t('credits_remaining', { credits: 0 })}</span>
                  </div>
                ) : user && remainingCredits > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-primary">
                      {t('credits_cost', { credits: costCredits })}
                    </span>
                    <span>
                      {t('credits_remaining', { credits: remainingCredits })}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-primary">
                        {t('credits_cost', { credits: costCredits })}
                      </span>
                      <span>
                        {t('credits_remaining', { credits: remainingCredits })}
                      </span>
                    </div>
                    <Link href="/pricing">
                      <Button variant="outline" className="w-full" size="lg">
                        <CreditCard className="mr-2 h-4 w-4" />
                        {t('buy_credits')}
                      </Button>
                    </Link>
                  </div>
                )}

                {/* 生成进度 */}
                {isGenerating && (
                  <div className="space-y-2 rounded-lg border p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('progress')}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} />
                    {taskStatusLabel && (
                      <p className="text-muted-foreground text-center text-xs">
                        {taskStatusLabel}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 移动端生成结果预览卡片 */}
            <Card className="mt-6 lg:hidden">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                  <ImageIcon className="h-5 w-5" />
                  {t('preview_title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-8">
                {generatedImages.length > 0 ? (
                  <div className="space-y-4">
                    {generatedImages.map((image) => (
                      <div key={image.id} className="space-y-3">
                        <div className="overflow-hidden rounded-lg border">
                          <LazyImage
                            src={image.url}
                            alt={image.prompt || 'Generated image'}
                            className="h-auto w-full"
                          />
                        </div>
                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full justify-center"
                            onClick={() => handleUseAsReference(image)}
                          >
                            <ImagePlus className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                            <span className="text-[10px] leading-tight whitespace-nowrap sm:text-xs">
                              {t('use_as_reference')}
                            </span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full justify-center"
                            onClick={() => handleDownloadImage(image)}
                            disabled={downloadingImageId === image.id}
                          >
                            {downloadingImageId === image.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 flex-shrink-0 animate-spin" />
                            ) : (
                              <Download className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                            )}
                            <span className="text-[10px] leading-tight whitespace-nowrap sm:text-xs">
                              {t('download_image')}
                            </span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : showExampleImage ? (
                  <div className="space-y-4">
                    <div className="relative isolate overflow-visible px-4 pt-6 pb-6 sm:px-8">
                      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
                        <div className="from-primary/30 via-primary/10 absolute inset-0 bg-gradient-to-br to-transparent" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,_rgba(255,255,255,0.18)_0%,_transparent_70%)]" />
                        <div className="from-background/60 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 z-40 h-6 w-6 rounded-full bg-black/50 text-white hover:bg-black/70"
                        onClick={() => setShowExampleImage(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <StackedHairstyleCards
                        items={EXAMPLE_STACK_ITEMS}
                        dialogTitle={t('preview_title')}
                      />
                    </div>
                    {/* Action Buttons for Example */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={() =>
                          handleUseAsReference({
                            id: EXAMPLE_MAIN_IMAGE.id,
                            url: EXAMPLE_MAIN_IMAGE.src,
                            prompt: EXAMPLE_MAIN_IMAGE.alt,
                          })
                        }
                      >
                        <ImagePlus className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-[10px] leading-tight whitespace-nowrap sm:text-xs">
                          {t('use_as_reference')}
                        </span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-center"
                        onClick={() =>
                          handleDownloadImage({
                            id: EXAMPLE_MAIN_IMAGE.id,
                            url: EXAMPLE_MAIN_IMAGE.src,
                            prompt: EXAMPLE_MAIN_IMAGE.alt,
                          })
                        }
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                        <span className="text-[10px] leading-tight whitespace-nowrap sm:text-xs">
                          {t('download_image')}
                        </span>
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-center text-xs">
                      {t('example_image_hint')}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                      <ImageIcon className="text-muted-foreground h-10 w-10" />
                    </div>
                    <p className="text-muted-foreground">
                      {isGenerating
                        ? t('ready_to_generate')
                        : t('no_images_generated')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>

          {/* 右侧历史和结果面板 */}
          {isRightPanelOpen && (
            <aside className="border-border/40 bg-card/40 hidden h-full flex-col overflow-hidden rounded-3xl border shadow-xl backdrop-blur-xl transition-all duration-300 lg:flex">
              <Tabs
                value={rightTab}
                onValueChange={(value) =>
                  setRightTab(value as 'history' | 'discover')
                }
                className="flex h-full flex-col"
              >
                <div className="shrink-0 border-b p-4">
                  <div className="flex items-center justify-between">
                    <TabsList className="grid w-full max-w-[280px] grid-cols-2">
                      <TabsTrigger value="history" className="text-xs">
                        {t('sidebar.history')}
                      </TabsTrigger>
                      <TabsTrigger value="discover" className="text-xs">
                        {t('sidebar.discover')}
                      </TabsTrigger>
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsRightPanelOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-6 p-4">
                    {/* History 历史图片内容 */}
                    {rightTab === 'history' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-5 w-5" />
                          <h4 className="font-semibold">
                            {t('history_images')}
                          </h4>
                        </div>

                        {!user ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                              <User className="text-muted-foreground h-8 w-8" />
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {t('sidebar.history_sign_in')}
                            </p>
                          </div>
                        ) : historyPanelImages.length > 0 ? (
                          <div className="flex flex-col gap-4 px-1 pb-2">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {historyPanelImages.slice(0, 6).map((image) => (
                                <button
                                  key={image.id}
                                  type="button"
                                  className="group hover:border-foreground/20 bg-background/40 w-full overflow-hidden rounded-xl border text-left shadow-sm transition-colors"
                                  onClick={() => setSelectedPreviewImage(image)}
                                  aria-label={t('history_view_image')}
                                >
                                  <div className="relative aspect-[3/4] overflow-hidden">
                                    <LazyImage
                                      src={image.url}
                                      alt={image.prompt || 'History image'}
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                    />
                                  </div>
                                </button>
                              ))}
                            </div>
                            {historyPanelImages.length > 6 && (
                              <div className="pt-2">
                                <Link
                                  href="/activity/ai-tasks"
                                  className="block w-full"
                                >
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="w-full text-xs"
                                  >
                                    <span>View All History</span>
                                    <ChevronRight className="ml-1 h-3 w-3" />
                                  </Button>
                                </Link>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                              <ImageIcon className="text-muted-foreground h-10 w-10" />
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {t('sidebar.history_empty')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <Dialog
                      open={!!selectedPreviewImage}
                      onOpenChange={(open) =>
                        !open && setSelectedPreviewImage(null)
                      }
                    >
                      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0 sm:max-w-4xl">
                        {selectedPreviewImage && (
                          <div className="flex max-h-[92vh] flex-col">
                            <DialogHeader className="border-b px-6 py-3">
                              <DialogTitle className="text-base">
                                {t('preview_title')}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="bg-muted/30 flex flex-1 items-center justify-center overflow-hidden p-4 md:p-6">
                              <LazyImage
                                src={selectedPreviewImage.url}
                                alt={
                                  selectedPreviewImage.prompt ||
                                  'Preview image'
                                }
                                className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2 border-t px-4 py-3 md:px-6">
                              <Button
                                variant="outline"
                                className="w-full justify-center"
                                onClick={() => {
                                  handleUseAsReference(selectedPreviewImage);
                                  setSelectedPreviewImage(null);
                                }}
                              >
                                <ImagePlus className="mr-2 h-4 w-4 flex-shrink-0" />
                                <span className="whitespace-nowrap">
                                  {t('use_as_reference')}
                                </span>
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full justify-center"
                                onClick={() =>
                                  handleDownloadImage(selectedPreviewImage)
                                }
                                disabled={
                                  downloadingImageId ===
                                  selectedPreviewImage.id
                                }
                              >
                                {downloadingImageId ===
                                selectedPreviewImage.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 flex-shrink-0 animate-spin" />
                                ) : (
                                  <Download className="mr-2 h-4 w-4 flex-shrink-0" />
                                )}
                                <span className="whitespace-nowrap">
                                  {t('download_image')}
                                </span>
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>

                    {/* Discover 生成结果内容 */}
                    {rightTab === 'discover' && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-5 w-5" />
                          <h4 className="font-semibold">
                            {t('generated_images')}
                          </h4>
                        </div>

                        {generatedImages.length > 0 ? (
                          <div className="space-y-4">
                            {generatedImages.map((image) => (
                              <div key={image.id} className="space-y-3">
                                <button
                                  type="button"
                                  className="group hover:border-foreground/20 block w-full overflow-hidden rounded-lg border text-left transition-colors"
                                  onClick={() => setSelectedPreviewImage(image)}
                                  aria-label={t('history_view_image')}
                                >
                                  <LazyImage
                                    src={image.url}
                                    alt={image.prompt || 'Generated image'}
                                    className="h-auto w-full transition-transform duration-300 group-hover:scale-[1.02]"
                                  />
                                </button>
                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full justify-center px-2 text-xs"
                                    onClick={() => handleUseAsReference(image)}
                                  >
                                    <ImagePlus className="mr-1 h-3 w-3 flex-shrink-0" />
                                    <span className="text-[10px] whitespace-nowrap">
                                      {t('use_as_reference')}
                                    </span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full justify-center px-2 text-xs"
                                    onClick={() => handleDownloadImage(image)}
                                    disabled={downloadingImageId === image.id}
                                  >
                                    {downloadingImageId === image.id ? (
                                      <Loader2 className="mr-1 h-3 w-3 flex-shrink-0 animate-spin" />
                                    ) : (
                                      <Download className="mr-1 h-3 w-3 flex-shrink-0" />
                                    )}
                                    <span className="text-[10px] whitespace-nowrap">
                                      {t('download_image')}
                                    </span>
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : showExampleImage ? (
                          <div className="space-y-4">
                            <div className="relative isolate overflow-visible px-2 pt-5 pb-5">
                              <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
                                <div className="from-primary/30 via-primary/10 absolute inset-0 bg-gradient-to-br to-transparent" />
                                <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,_rgba(255,255,255,0.18)_0%,_transparent_70%)]" />
                                <div className="from-background/60 absolute inset-0 bg-gradient-to-t via-transparent to-transparent" />
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-1 right-1 z-40 h-5 w-5 rounded-full bg-black/50 text-white hover:bg-black/70"
                                onClick={() => setShowExampleImage(false)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <StackedHairstyleCards
                                items={EXAMPLE_STACK_ITEMS}
                                dialogTitle={t('preview_title')}
                              />
                            </div>
                            {/* Action Buttons for Example */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full justify-center px-2 text-xs"
                                onClick={() =>
                                  handleUseAsReference({
                                    id: EXAMPLE_MAIN_IMAGE.id,
                                    url: EXAMPLE_MAIN_IMAGE.src,
                                    prompt: EXAMPLE_MAIN_IMAGE.alt,
                                  })
                                }
                              >
                                <ImagePlus className="mr-1 h-3 w-3 flex-shrink-0" />
                                <span className="text-[10px] whitespace-nowrap">
                                  {t('use_as_reference')}
                                </span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full justify-center px-2 text-xs"
                                onClick={() =>
                                  handleDownloadImage({
                                    id: EXAMPLE_MAIN_IMAGE.id,
                                    url: EXAMPLE_MAIN_IMAGE.src,
                                    prompt: EXAMPLE_MAIN_IMAGE.alt,
                                  })
                                }
                              >
                                <Download className="mr-1 h-3 w-3 flex-shrink-0" />
                                <span className="text-[10px] whitespace-nowrap">
                                  {t('download_image')}
                                </span>
                              </Button>
                            </div>
                            <p className="text-muted-foreground text-center text-xs">
                              {t('example_image_hint')}
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                              <ImageIcon className="text-muted-foreground h-10 w-10" />
                            </div>
                            <p className="text-muted-foreground text-sm">
                              {isGenerating
                                ? t('ready_to_generate')
                                : t('no_images_generated')}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Tabs>
            </aside>
          )}

          {/* 右侧打开按钮 - 移动端（已隐藏，生成结果在下方显示） */}
          {/* <Button
            variant="outline"
            size="icon"
            className="bg-background/95 fixed right-4 bottom-4 z-40 h-12 w-12 shadow-lg backdrop-blur-sm lg:hidden"
            onClick={() => setIsRightSheetOpen(true)}
          >
            <PanelRight className="h-5 w-5" />
          </Button> */}

          {/* 右侧教程和结果面板 - 移动端 Sheet（已隐藏，生成结果在下方显示） */}
          {/* 移动端生成结果已移至中间区域下方，不再需要右侧 Sheet */}
        </div>
      </div>
    </section>
  );
}
