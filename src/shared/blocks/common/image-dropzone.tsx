'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { IconUpload, IconX } from '@tabler/icons-react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

import { ImageUploaderValue } from './image-uploader';
import { isImageFile, uploadImageFile } from './upload-image';

interface ImageDropzoneProps {
  title?: string;
  hint?: string;
  ctaTitle?: string;
  ctaSubtitle?: string;
  uploadingLabel?: string;
  uploadFailedLabel?: string;
  maxSizeMB?: number;
  className?: string;
  onChange?: (items: ImageUploaderValue[]) => void;
}

export function ImageDropzone({
  title,
  hint,
  ctaTitle,
  ctaSubtitle,
  uploadingLabel,
  uploadFailedLabel,
  maxSizeMB = 10,
  className,
  onChange,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [item, setItem] = useState<ImageUploaderValue | null>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  useEffect(() => {
    onChange?.(item ? [item] : []);
  }, [item, onChange]);

  const openPicker = () => inputRef.current?.click();

  const handleFile = useCallback(
    async (file: File) => {
      if (!isImageFile(file)) {
        toast.error('Only image files are supported');
        return;
      }
      if (file.size > maxBytes) {
        toast.error(`"${file.name}" exceeds the ${maxSizeMB}MB limit`);
        return;
      }

      const localPreview = URL.createObjectURL(file);
      setItem({
        id: `${file.name}-${file.lastModified}`,
        preview: localPreview,
        status: 'uploading',
        size: file.size,
      });

      setIsUploading(true);
      try {
        const url = await uploadImageFile(file);
        URL.revokeObjectURL(localPreview);
        setItem({
          id: `${file.name}-${file.lastModified}`,
          preview: url,
          url,
          status: 'uploaded',
          size: file.size,
        });
      } catch (error: any) {
        console.error('Upload failed:', error);
        toast.error(
          error?.message ? `Upload failed: ${error.message}` : 'Upload failed'
        );
        setItem((prev) =>
          prev ? { ...prev, status: 'error' as const } : prev
        );
      } finally {
        setIsUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [maxBytes, maxSizeMB]
  );

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFile(file);
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

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);

    const file = Array.from(event.dataTransfer?.files || []).find((f) =>
      isImageFile(f)
    );
    if (!file) return;
    await handleFile(file);
  };

  const handleRemove = () => {
    if (item?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(item.preview);
    }
    setItem(null);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <div className="text-foreground flex items-center justify-between text-sm font-medium">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-primary h-4 w-4" />
            <span>{title}</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'group relative rounded-2xl border border-dashed p-6 transition',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border bg-muted/20 hover:bg-muted/30'
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleSelect}
          className="hidden"
        />

        {item?.preview ? (
          <div className="relative overflow-hidden rounded-xl border">
            <img
              src={item.preview}
              alt="Uploaded"
              className="h-[280px] w-full object-cover md:h-[360px]"
            />

            {item.status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {uploadingLabel || 'Uploading...'}
              </div>
            )}

            {item.status === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/50 text-white">
                {uploadFailedLabel || 'Upload failed. Try again.'}
              </div>
            )}

            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute top-3 right-3 h-9 w-9 rounded-full"
              onClick={handleRemove}
              aria-label="Remove image"
              disabled={isUploading}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center"
            onClick={openPicker}
            disabled={isUploading}
          >
            <div className="border-border bg-background/60 flex h-14 w-14 items-center justify-center rounded-full border border-dashed">
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <IconUpload className="h-7 w-7" />
              )}
            </div>
            <div className="space-y-1">
              <div className="text-base font-medium">
                {ctaTitle || 'Click or drag to upload a photo'}
              </div>
              <div className="text-muted-foreground text-sm">
                {ctaSubtitle ||
                  hint ||
                  `Supports JPG/PNG, up to ${maxSizeMB}MB`}
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
