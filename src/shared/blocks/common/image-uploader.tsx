'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconRefresh, IconUpload, IconX } from '@tabler/icons-react';
import { ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { CropImageModal } from './crop-image-modal';
import { PhotoGuidelinesModal } from './photo-guidelines-modal';
import { isImageFile, uploadImageFile } from './upload-image';

export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface ImageUploaderValue {
  id: string;
  preview: string;
  url?: string;
  status: UploadStatus;
  size?: number;
}

interface ImageUploaderProps {
  allowMultiple?: boolean;
  maxImages?: number;
  maxSizeMB?: number;
  title?: string;
  emptyHint?: string;
  uploadLabel?: string;
  emptyUploadLabel?: string;
  maxSizeLabel?: string;
  className?: string;
  defaultPreviews?: string[];
  onChange?: (items: ImageUploaderValue[]) => void;
  showGuidelines?: boolean;
  enableCrop?: boolean;
}

interface UploadItem extends ImageUploaderValue {
  file?: File;
  uploadKey?: string;
}

const formatBytes = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
};


export function ImageUploader({
  allowMultiple = false,
  maxImages = 1,
  maxSizeMB = 10,
  title,
  emptyHint,
  uploadLabel = 'Upload',
  emptyUploadLabel = 'Click or drag to upload photos',
  maxSizeLabel = 'Max',
  className,
  defaultPreviews,
  onChange,
  showGuidelines = false,
  enableCrop = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isInitializedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const isInternalChangeRef = useRef(false);
  const replaceTargetIdRef = useRef<string | null>(null);
  const dragCounterRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  // Modal states
  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<{
    file: File;
    preview: string;
    replaceTargetId: string | null;
  } | null>(null);

  // 使用 defaultPreviews 初始化 items，只在组件挂载时执行一次
  const [items, setItems] = useState<UploadItem[]>(() => {
    if (defaultPreviews?.length) {
      return defaultPreviews.map((url, index) => ({
        id: `preset-${url}-${index}`,
        preview: url,
        url,
        status: 'uploaded' as UploadStatus,
      }));
    }
    return [];
  });

  const maxCount = allowMultiple ? maxImages : 1;
  const maxBytes = maxSizeMB * 1024 * 1024;

  // 更新 onChange ref
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 同步 defaultPreviews 的变化（只在外部变化时同步，避免循环）
  useEffect(() => {
    // 跳过初始化
    if (!isInitializedRef.current) {
      return;
    }

    // 如果是内部变化触发的，跳过
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const defaultUrls = defaultPreviews || [];

    // 使用函数式更新来访问最新的 items
    setItems((currentItems) => {
      const currentUrls = currentItems
        .filter((item) => item.status === 'uploaded' && item.url)
        .map((item) => item.url as string);

      // 比较当前 items 和 defaultPreviews 是否一致
      const isSame =
        defaultUrls.length === currentUrls.length &&
        defaultUrls.every((url, index) => url === currentUrls[index]);

      // 只有当不一致时才返回新的 items
      if (!isSame) {
        return defaultUrls.map((url, index) => ({
          id: `preset-${url}-${index}`,
          preview: url,
          url,
          status: 'uploaded' as UploadStatus,
        }));
      }

      return currentItems;
    });
  }, [defaultPreviews]);

  // 清理 blob URLs
  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.preview.startsWith('blob:')) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [items]);

  // 当 items 变化时触发 onChange，但跳过初始化时的调用
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    // 标记这是内部变化
    isInternalChangeRef.current = true;

    onChangeRef.current?.(
      items.map(({ id, preview, url, status, size }) => ({
        id,
        preview,
        url,
        status,
        size,
      }))
    );
  }, [items]);

  const replaceItems = (pairs: Array<{ id: string; file: File }>) => {
    pairs.forEach(({ id, file }) => {
      const uploadKey = `${Date.now()}-${Math.random()}`;
      const nextPreview = URL.createObjectURL(file);

      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          if (item.preview.startsWith('blob:')) {
            URL.revokeObjectURL(item.preview);
          }
          return {
            ...item,
            preview: nextPreview,
            file,
            size: file.size,
            url: undefined,
            status: 'uploading' as UploadStatus,
            uploadKey,
          };
        })
      );

      uploadImageFile(file)
        .then((url) => {
          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== id) return item;
              if (item.uploadKey !== uploadKey) return item; // stale upload
              if (item.preview.startsWith('blob:')) {
                URL.revokeObjectURL(item.preview);
              }
              return {
                ...item,
                preview: url,
                url,
                status: 'uploaded' as UploadStatus,
                file: undefined,
              };
            })
          );
        })
        .catch((error: any) => {
          console.error('Upload failed:', error);
          toast.error(
            error?.message ? `Upload failed: ${error.message}` : 'Upload failed'
          );
          setItems((prev) =>
            prev.map((item) => {
              if (item.id !== id) return item;
              if (item.uploadKey !== uploadKey) return item; // stale upload
              return { ...item, status: 'error' as UploadStatus };
            })
          );
        })
        .finally(() => {
          if (inputRef.current) inputRef.current.value = '';
        });
    });
  };

  const processFiles = (selectedFiles: File[], replaceTargetId: string | null) => {
    if (replaceTargetId) {
      const file = selectedFiles[0];
      if (!file) return;
      if (!isImageFile(file)) {
        toast.error('Only image files are supported');
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" exceeds the ${maxSizeMB}MB limit`);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      replaceItems([{ id: replaceTargetId, file }]);
      return;
    }

    const availableSlots = maxCount - items.length;
    const filesToAdd = selectedFiles
      .filter((file) => {
        if (!isImageFile(file)) {
          toast.error(`"${file.name}" is not an image`);
          return false;
        }
        if (file.size > maxBytes) {
          toast.error(`"${file.name}" exceeds the ${maxSizeMB}MB limit`);
          return false;
        }
        return true;
      })
      .slice(0, Math.max(availableSlots, 0));

    if (!filesToAdd.length) {
      // when full: replace from the end backwards
      if (items.length) {
        const normalized = selectedFiles.filter((file) => isImageFile(file));
        if (!normalized.length) return;

        const k = Math.min(normalized.length, items.length);
        const tail = items.slice(-k);
        const pairs: Array<{ id: string; file: File }> = [];

        for (let i = 0; i < k; i += 1) {
          const targetId = tail[tail.length - 1 - i]?.id;
          const file = normalized[i];
          if (targetId && file) pairs.push({ id: targetId, file });
        }

        if (pairs.length) {
          replaceItems(pairs);
        }
      }

      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    if (availableSlots < selectedFiles.length) {
      toast.message(
        `Only the first ${filesToAdd.length} image(s) will be added`
      );
    }

    const newItems = filesToAdd.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      preview: URL.createObjectURL(file),
      file,
      size: file.size,
      status: 'uploading' as UploadStatus,
      uploadKey: `${Date.now()}-${Math.random()}`,
    }));

    setItems((prev) => [...prev, ...newItems]);

    // Upload in parallel
    Promise.all(
      newItems.map(async (item) => {
        try {
          const url = await uploadImageFile(item.file as File);
          setItems((prev) => {
            const next = prev.map((current) => {
              if (current.id === item.id) {
                if (current.uploadKey && item.uploadKey) {
                  if (current.uploadKey !== item.uploadKey) return current; // stale upload
                }
                // Revoke the blob URL since we have the uploaded URL now
                if (current.preview.startsWith('blob:')) {
                  URL.revokeObjectURL(current.preview);
                }
                return {
                  ...current,
                  preview: url, // Replace preview with uploaded URL
                  url,
                  status: 'uploaded' as UploadStatus,
                  file: undefined,
                };
              }
              return current;
            });
            return next;
          });
        } catch (error: any) {
          console.error('Upload failed:', error);
          toast.error(
            error?.message ? `Upload failed: ${error.message}` : 'Upload failed'
          );
          setItems((prev) => {
            const next = prev.map((current) => {
              if (current.id !== item.id) return current;
              if (current.uploadKey && current.uploadKey !== item.uploadKey) {
                return current; // stale upload
              }
              return { ...current, status: 'error' as UploadStatus };
            });
            return next;
          });
        }
      })
    );

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFiles = (selectedFiles: File[]) => {
    // If crop is enabled and there is at least one file, open crop modal for the first one
    if (enableCrop && selectedFiles.length > 0) {
      const file = selectedFiles[0];
      if (isImageFile(file)) {
        // Create a blob URL for the preview
        const preview = URL.createObjectURL(file);
        setFileToCrop({
          file,
          preview,
          replaceTargetId: replaceTargetIdRef.current,
        });
        
        // Reset replace target until crop is done or cancelled
        // We stored it in fileToCrop state
        replaceTargetIdRef.current = null;
        
        setIsCropOpen(true);
        if (inputRef.current) inputRef.current.value = ''; // Reset input
        return;
      }
    }

    // Default flow
    const replaceTargetId = replaceTargetIdRef.current;
    if (replaceTargetId) {
      replaceTargetIdRef.current = null;
    }
    processFiles(selectedFiles, replaceTargetId);
  };

  const handleCropApply = async (croppedImage: string) => {
    setIsCropOpen(false);
    
    if (!fileToCrop) return;

    // Convert data URL to File
    try {
      const res = await fetch(croppedImage);
      const blob = await res.blob();
      const file = new File([blob], fileToCrop.file.name, { type: 'image/jpeg' });
      
      // Clean up previous preview
      URL.revokeObjectURL(fileToCrop.preview);
      
      // Process the cropped file
      processFiles([file], fileToCrop.replaceTargetId);
    } catch (e) {
      console.error('Failed to process cropped image', e);
      toast.error('Failed to process cropped image');
    } finally {
      setFileToCrop(null);
    }
  };

  const handleCropClose = () => {
    setIsCropOpen(false);
    if (fileToCrop) {
      URL.revokeObjectURL(fileToCrop.preview);
      setFileToCrop(null);
    }
  };

  const handleSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    handleFiles(selectedFiles);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const files = clipboardItems
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter(Boolean) as File[];

    if (!files.length) return;
    event.preventDefault();
    handleFiles(files);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    if (!isDragActive) setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);

    const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
      isImageFile(file)
    );
    if (!files.length) return;
    handleFiles(files);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return next;
    });
  };

  const openFilePicker = () => {
    if (showGuidelines) {
      setIsGuidelinesOpen(true);
    } else {
      inputRef.current?.click();
    }
  };

  const handeGuidelinesConfirm = () => {
    setIsGuidelinesOpen(false);
    inputRef.current?.click();
  };

  const openReplacePicker = (id: string) => {
    replaceTargetIdRef.current = id;
    openFilePicker();
  };

  const countLabel = useMemo(
    () => `${items.length}/${maxCount}`,
    [items.length, maxCount]
  );

  return (
    <div
      className={cn(
        'relative focus:outline-none',
        isDragActive &&
          'ring-primary/70 ring-offset-background ring-2 ring-offset-2',
        className
      )}
      tabIndex={0}
      onPaste={handlePaste}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/10 backdrop-blur-sm">
          <div className="bg-background/80 text-foreground rounded-full px-4 py-2 text-sm font-medium shadow-sm">
            Drop to upload
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={allowMultiple}
        onChange={handleSelect}
        className="hidden"
      />

      {title && (
        <div className="text-foreground flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-primary h-4 w-4" />
            <span>{title}</span>
            <span className="text-primary text-xs">({countLabel})</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-wrap gap-4',
          allowMultiple ? 'flex-wrap' : 'flex-nowrap'
        )}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border p-1 shadow-sm transition"
          >
            <div className="relative overflow-hidden rounded-lg">
              <img
                src={item.preview}
                alt="Reference"
                className="h-32 w-32 rounded-lg object-cover"
              />
              {item.size && (
                <span className="bg-background text-muted-foreground absolute bottom-2 left-2 rounded-md px-2 py-1 text-[10px] font-medium">
                  {formatBytes(item.size)}
                </span>
              )}
              {item.status !== 'uploading' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="bg-background/50 text-foreground hover:bg-background/50 h-10 w-10 rounded-full shadow-sm backdrop-blur focus-visible:ring-2 focus-visible:ring-white/70"
                    onClick={() => openReplacePicker(item.id)}
                    aria-label="Upload a new image to replace"
                  >
                    <IconRefresh className="h-5 w-5" />
                  </Button>
                </div>
              )}
              {item.status === 'uploading' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 text-xs font-medium text-white">
                  Uploading...
                </div>
              )}
              {item.status === 'error' && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-500/70 text-xs font-medium text-white">
                  Failed
                </div>
              )}
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 z-20 h-7 w-7"
                onClick={() => handleRemove(item.id)}
                aria-label="Remove image"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        {items.length < maxCount && (
          <div className={cn(
            "group border-border bg-muted/50 hover:border-border hover:bg-muted relative overflow-hidden rounded-xl border border-dashed p-1 shadow-sm transition",
            items.length === 0 && "w-full"
          )}>
            <div className="relative overflow-hidden rounded-lg">
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center gap-2",
                  items.length === 0 ? "h-48 w-full py-8" : "h-32 w-32"
                )}
                onClick={openFilePicker}
              >
                <div className={cn(
                  "border-border flex items-center justify-center rounded-full border border-dashed",
                  items.length === 0 ? "h-14 w-14" : "h-10 w-10"
                )}>
                  <IconUpload className={cn(items.length === 0 ? "h-7 w-7" : "h-5 w-5")} />
                </div>
                <span className={cn("font-medium", items.length === 0 ? "text-sm" : "text-xs")}>
                  {items.length === 0 ? emptyUploadLabel : uploadLabel}
                </span>
                <span className="text-primary text-xs">{maxSizeLabel} {maxSizeMB}MB</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {!title && (
        <div className="text-muted-foreground text-xs">{emptyHint}</div>
      )}

      {/* Modals */}
      <PhotoGuidelinesModal
        open={isGuidelinesOpen}
        onClose={() => setIsGuidelinesOpen(false)}
        onConfirm={handeGuidelinesConfirm}
      />

      <CropImageModal
        open={isCropOpen}
        imageSrc={fileToCrop?.preview || ''}
        onClose={handleCropClose}
        onApply={handleCropApply}
      />
    </div>
  );
}
