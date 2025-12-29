'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  CreditCard,
  Download,
  ImageIcon,
  Lightbulb,
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
import { HAIRSTYLE_SYSTEM_PROMPT } from '@/config/img-prompt';
import { AIMediaType, AITaskStatus } from '@/extensions/ai/types';
import {
  ImageDropzone,
  ImageUploader,
  ImageUploaderValue,
  LazyImage,
} from '@/shared/blocks/common';
import { HairstyleCategorySelector } from '@/shared/components/hairstyle-category-selector';
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
import { cn } from '@/shared/lib/utils';

interface ImageGeneratorProps {
  allowMultipleImages?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  srOnlyTitle?: string;
  className?: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  provider?: string;
  model?: string;
  prompt?: string;
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

type ImageGeneratorTab = 'text-to-image' | 'image-to-image';

const POLL_INTERVAL = 5000;
const GENERATION_TIMEOUT = 180000;
const MAX_PROMPT_LENGTH = 2000;

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

const MODEL_OPTIONS = [
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

export function ImageGenerator({
  allowMultipleImages = true,
  maxImages = 8,
  maxSizeMB = 5,
  srOnlyTitle,
  className,
}: ImageGeneratorProps) {
  const t = useTranslations('ai.image.generator');

  const [activeTab, setActiveTab] =
    useState<ImageGeneratorTab>('image-to-image');

  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'howtos' | 'discover'>('discover');
  const [isLeftSheetOpen, setIsLeftSheetOpen] = useState(false);
  const [isRightSheetOpen, setIsRightSheetOpen] = useState(false);
  const [selectedHairstyleName, setSelectedHairstyleName] = useState<
    string | null
  >(null);
  const [selectedHairstyle, setSelectedHairstyle] = useState<Hairstyle | null>(null);

  const [costCredits, setCostCredits] = useState<number>(6);
  const [provider, setProvider] = useState(PROVIDER_OPTIONS[3]?.value ?? 'kie');
  const [model, setModel] = useState('nano-banana-pro');
  const [prompt, setPrompt] = useState('');
  const [referenceImageItems, setReferenceImageItems] = useState<
    ImageUploaderValue[]
  >([]);
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
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
  const [isMounted, setIsMounted] = useState(false);

  // Dynamic hairstyles from database
  const [hairstyles, setHairstyles] = useState<Record<string, Hairstyle[]>>({});
  const [categoryData, setCategoryData] = useState<HairstyleCategory[]>([]);
  const [isLoadingHairstyles, setIsLoadingHairstyles] = useState(true);

  const { user, isCheckSign, setIsShowSignModal, fetchUserCredits } =
    useAppContext();

  // Fetch hairstyles from API on mount
  useEffect(() => {
    setIsMounted(true);
    
    const fetchHairstyles = async () => {
      try {
        const resp = await fetch('/api/hairstyle/list');
        if (!resp.ok) throw new Error('Failed to fetch');
        
        const { data } = await resp.json();
        if (data?.hairstyles && data?.categories) {
          // Group hairstyles by category
          const grouped: Record<string, Hairstyle[]> = {};
          for (const h of data.hairstyles) {
            if (!grouped[h.category]) {
              grouped[h.category] = [];
            }
            grouped[h.category].push(h);
          }
          setHairstyles(grouped);
          
          // Convert categories object to array
          const cats: HairstyleCategory[] = Object.entries(data.categories).map(
            ([key, count]) => ({ key: key as HairstyleCategoryKey, count: count as number })
          );
          // Sort by predefined order
          const order = ['men', 'women', 'boys', 'girls'];
          cats.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
          setCategoryData(cats.length > 0 ? cats : FALLBACK_CATEGORIES);
        } else {
          setCategoryData(FALLBACK_CATEGORIES);
        }
      } catch (error) {
        console.error('Failed to load hairstyles:', error);
        setCategoryData(FALLBACK_CATEGORIES);
      } finally {
        setIsLoadingHairstyles(false);
      }
    };
    
    fetchHairstyles();
  }, []);

  const promptLength = prompt.trim().length;
  const remainingCredits = user?.credits?.remainingCredits ?? 0;
  const isPromptTooLong = promptLength > MAX_PROMPT_LENGTH;
  const isTextToImageMode = activeTab === 'text-to-image';

  const handleTabChange = (value: string) => {
    const tab = value as ImageGeneratorTab;
    setActiveTab(tab);

    const availableModels = MODEL_OPTIONS.filter(
      (option) => option.scenes.includes(tab) && option.provider === provider
    );

    if (availableModels.length > 0) {
      setModel(availableModels[0].value);
    } else {
      setModel('');
    }

    if (tab === 'text-to-image') {
      setCostCredits(4);
    } else {
      setCostCredits(6);
    }
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);

    const availableModels = MODEL_OPTIONS.filter(
      (option) => option.scenes.includes(activeTab) && option.provider === value
    );

    if (availableModels.length > 0) {
      setModel(availableModels[0].value);
    } else {
      setModel('');
    }
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

  const resetTaskState = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setTaskId(null);
    setGenerationStartTime(null);
    setTaskStatus(null);
  }, []);

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
            setGeneratedImages(
              imageUrls.map((url, index) => ({
                id: `${task.id}-${index}`,
                url,
                provider: task.provider,
                model: task.model,
                prompt: task.prompt ?? undefined,
              }))
            );
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
        toast.error(`Query task failed: ${error.message}`);
        resetTaskState();

        fetchUserCredits();

        return true;
      }
    },
    [generationStartTime, resetTaskState]
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
    const hasHairstyle = !!selectedHairstyle;
    
    // Construct the final prompt including hairstyle info if selected
    let finalPrompt = trimmedPrompt;
    if (selectedHairstyle) {
      const hairstylePrompt = `${selectedHairstyle.name} hairstyle: professional style with great detail`;
      finalPrompt = trimmedPrompt ? `${trimmedPrompt} ${hairstylePrompt}` : hairstylePrompt;
    }
    
    // Append system prompt for better generation quality
    finalPrompt = `${finalPrompt} ${HAIRSTYLE_SYSTEM_PROMPT}`;

    if (!finalPrompt) {
      toast.error('Please enter a prompt or select a hairstyle before generating.');
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

    try {
      const options: any = {};

      if (!isTextToImageMode) {
        options.image_input = referenceImageUrls;
      }
      
      if (selectedHairstyle) {
        options.hairstyle_image = selectedHairstyle.imageUrl;
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
            setGeneratedImages(
              imageUrls.map((url, index) => ({
                id: `${newTaskId}-${index}`,
                url,
                provider,
                model,
                prompt: finalPrompt,
              }))
            );
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
      // fetch image via proxy
      const resp = await fetch(
        `/api/proxy/file?url=${encodeURIComponent(image.url)}`
      );
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
      toast.success('Image downloaded');
    } catch (error) {
      console.error('Failed to download image:', error);
      toast.error('Failed to download image');
    } finally {
      setDownloadingImageId(null);
    }
  };

  return (
    <section className={cn('py-4 md:py-8 lg:py-12', className)}>
      {srOnlyTitle && <h2 className="sr-only">{srOnlyTitle}</h2>}
      <div className="container px-4">
        <div
          className={cn(
            'relative mx-auto grid max-w-[1800px] items-stretch gap-4',
            'grid-cols-1',
            isLeftPanelOpen &&
              isRightPanelOpen &&
              'lg:grid-cols-[minmax(340px,400px)_minmax(500px,1fr)_minmax(340px,400px)]',
            isLeftPanelOpen &&
              !isRightPanelOpen &&
              'lg:grid-cols-[minmax(340px,400px)_minmax(500px,1fr)]',
            !isLeftPanelOpen &&
              isRightPanelOpen &&
              'lg:grid-cols-[minmax(500px,1fr)_minmax(340px,400px)]',
            !isLeftPanelOpen && !isRightPanelOpen && 'lg:grid-cols-1'
          )}
        >
          {/* 左侧发型选择面板 - 桌面端 (紧凑下拉式) */}
          {isLeftPanelOpen && (
            <aside className="bg-card hidden flex-col overflow-hidden rounded-lg border shadow-sm lg:flex">
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

          {/* 左侧发型选择面板 - 移动端 Sheet */}
          <Sheet open={isLeftSheetOpen} onOpenChange={setIsLeftSheetOpen}>
            <SheetContent side="left" className="w-[85vw] p-0 sm:max-w-sm">
              <div className="flex h-full flex-col">
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
                    }}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>


          {/* 左侧打开按钮 - 移动端 */}
          <Button
            variant="outline"
            size="icon"
            className="bg-background/95 fixed bottom-4 left-4 z-40 h-12 w-12 shadow-lg backdrop-blur-sm lg:hidden"
            onClick={() => setIsLeftSheetOpen(true)}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>

          {/* 中间主区域 */}
          <main className="min-w-0 flex-1 space-y-4 md:space-y-6 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardContent className="space-y-4 p-4 md:space-y-6 md:p-6">
                {/* 侧边栏展开按钮 - 桌面端 */}
                <div className="hidden lg:flex justify-between items-center -mt-2 mb-2">
                  {!isLeftPanelOpen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsLeftPanelOpen(true)}
                      className="gap-1 text-muted-foreground hover:text-foreground"
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
                      className="gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <span className="text-xs">{t('sidebar.discover')}</span>
                      <PanelRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>
                {/* 发型选择提示 - 仅移动端显示 */}
                <div className="lg:hidden">
                  <button
                    type="button"
                    onClick={() => setIsLeftSheetOpen(true)}
                    className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      className={
                        selectedHairstyleName
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }
                    >
                      {selectedHairstyleName ||
                        t('form.select_hairstyle_placeholder')}
                    </span>
                    <ChevronRight className="text-muted-foreground h-4 w-4" />
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

                {/* AI发型描述 */}
                <div className="space-y-2">
                  <Label htmlFor="image-prompt">{t('form.prompt')}</Label>
                  <Textarea
                    id="image-prompt"
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                    }}
                    placeholder={t('form.prompt_placeholder')}
                    className="min-h-32"
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
                  <Button className="w-full" disabled size="lg">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('loading')}
                  </Button>
                ) : isCheckSign ? (
                  <Button className="w-full" disabled size="lg">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('checking_account')}
                  </Button>
                ) : user ? (
                  <Button
                    size="lg"
                    className="w-full"
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
                    className="w-full"
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
                      <div key={image.id} className="space-y-2">
                        <div className="relative overflow-hidden rounded-lg border">
                          <LazyImage
                            src={image.url}
                            alt={image.prompt || 'Generated image'}
                            className="h-auto w-full"
                          />
                          <div className="absolute right-2 bottom-2 flex justify-end text-sm">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto"
                              onClick={() => handleDownloadImage(image)}
                              disabled={downloadingImageId === image.id}
                            >
                              {downloadingImageId === image.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
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

          {/* 右侧教程和结果面板 */}
          {isRightPanelOpen && (
            <aside className="bg-card hidden flex-col overflow-hidden rounded-lg border shadow-sm lg:flex">
              <Tabs
                value={rightTab}
                onValueChange={(value) =>
                  setRightTab(value as 'howtos' | 'discover')
                }
                className="flex h-full flex-col"
              >
                <div className="shrink-0 border-b p-4">
                  <div className="flex items-center justify-between">
                    <TabsList className="grid w-full max-w-[280px] grid-cols-2">
                      <TabsTrigger value="howtos" className="text-xs">
                        {t('sidebar.howtos')}
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
                    {/* How-tos 教程内容 */}
                    {rightTab === 'howtos' && (
                      <div className="space-y-4">
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                          <div className="bg-primary/10 mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                            <Lightbulb className="text-primary h-6 w-6" />
                          </div>
                          <h4 className="mb-2 font-semibold">
                            {t('sidebar.tour_title')}
                          </h4>
                          <p className="text-muted-foreground text-xs">
                            {t('sidebar.tour_description')}
                          </p>
                          <Button variant="outline" size="sm" className="mt-3">
                            {t('sidebar.start_tour')}
                          </Button>
                        </div>
                      </div>
                    )}

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
                              <div key={image.id} className="space-y-2">
                                <div className="relative overflow-hidden rounded-lg border">
                                  <LazyImage
                                    src={image.url}
                                    alt={image.prompt || 'Generated image'}
                                    className="h-auto w-full"
                                  />
                                  <div className="absolute right-2 bottom-2 flex justify-end text-sm">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="ml-auto"
                                      onClick={() => handleDownloadImage(image)}
                                      disabled={downloadingImageId === image.id}
                                    >
                                      {downloadingImageId === image.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Download className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
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
