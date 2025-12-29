'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, RotateCw, RefreshCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

interface CropImageModalProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onApply: (croppedImage: string) => void;
}

type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | 'free';

export function CropImageModal({
  open,
  imageSrc,
  onClose,
  onApply,
}: CropImageModalProps) {
  const t = useTranslations('ai.image.generator.cropImage');
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('free');
  const [rotation, setRotation] = useState(0);
  const [cropArea, setCropArea] = useState({
    x: 50,
    y: 50,
    width: 200,
    height: 200,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const aspectRatios: {
    label: string;
    value: AspectRatio;
    ratio: number | null;
  }[] = [
    { label: '16:9', value: '16:9', ratio: 16 / 9 },
    { label: '9:16', value: '9:16', ratio: 9 / 16 },
    { label: '1:1', value: '1:1', ratio: 1 },
    { label: '4:3', value: '4:3', ratio: 4 / 3 },
    { label: '3:4', value: '3:4', ratio: 3 / 4 },
    { label: '3:2', value: '3:2', ratio: 3 / 2 },
  ];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset crop area when image changes or modal opens
  useEffect(() => {
    if (open && imageRef.current) {
      const img = imageRef.current;
      const updateSize = () => {
        const containerWidth = containerRef.current?.clientWidth || 600;
        const containerHeight = containerRef.current?.clientHeight || 500;

        const imgRatio = img.naturalWidth / img.naturalHeight;
        let displayWidth = containerWidth - (isMobile ? 32 : 48);
        let displayHeight = displayWidth / imgRatio;

        if (displayHeight > containerHeight - (isMobile ? 32 : 48)) {
          displayHeight = containerHeight - (isMobile ? 32 : 48);
          displayWidth = displayHeight * imgRatio;
        }

        setImageSize({ width: displayWidth, height: displayHeight });

        // Set initial crop area to center 70% of image
        const cropWidth = displayWidth * 0.7;
        const cropHeight = displayHeight * 0.7;
        setCropArea({
          x: (displayWidth - cropWidth) / 2,
          y: (displayHeight - cropHeight) / 2,
          width: cropWidth,
          height: cropHeight,
        });
      };

      if (img.complete) {
        updateSize();
      } else {
        img.onload = updateSize;
      }
    }
  }, [open, imageSrc, isMobile]);

  // Apply aspect ratio constraint
  useEffect(() => {
    if (selectedRatio !== 'free') {
      const ratioObj = aspectRatios.find((r) => r.value === selectedRatio);
      if (ratioObj?.ratio) {
        const newHeight = cropArea.width / ratioObj.ratio;
        setCropArea((prev) => ({
          ...prev,
          height: Math.min(newHeight, imageSize.height - prev.y),
        }));
      }
    }
  }, [selectedRatio]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, action: 'drag' | string) => {
      e.preventDefault();
      e.stopPropagation();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setDragStart({ x: clientX, y: clientY });
      if (action === 'drag') {
        setIsDragging(true);
      } else {
        setIsResizing(action);
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging && !isResizing) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dragStart.x;
      const dy = clientY - dragStart.y;
      setDragStart({ x: clientX, y: clientY });

      if (isDragging) {
        setCropArea((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(prev.x + dx, imageSize.width - prev.width)),
          y: Math.max(0, Math.min(prev.y + dy, imageSize.height - prev.height)),
        }));
      } else if (isResizing) {
        const ratioObj = aspectRatios.find((r) => r.value === selectedRatio);
        const ratio = ratioObj?.ratio;

        setCropArea((prev) => {
          const newArea = { ...prev };

          switch (isResizing) {
            case 'se':
              newArea.width = Math.max(
                50,
                Math.min(prev.width + dx, imageSize.width - prev.x)
              );
              newArea.height = ratio
                ? newArea.width / ratio
                : Math.max(
                    50,
                    Math.min(prev.height + dy, imageSize.height - prev.y)
                  );
              break;
            case 'sw':
              const newWidthSW = Math.max(50, prev.width - dx);
              newArea.x = prev.x + prev.width - newWidthSW;
              newArea.width = newWidthSW;
              newArea.height = ratio
                ? newArea.width / ratio
                : Math.max(
                    50,
                    Math.min(prev.height + dy, imageSize.height - prev.y)
                  );
              break;
            case 'ne':
              newArea.width = Math.max(
                50,
                Math.min(prev.width + dx, imageSize.width - prev.x)
              );
              const newHeightNE = ratio
                ? newArea.width / ratio
                : Math.max(50, prev.height - dy);
              newArea.y = prev.y + prev.height - newHeightNE;
              newArea.height = newHeightNE;
              break;
            case 'nw':
              const newWidthNW = Math.max(50, prev.width - dx);
              const newHeightNW = ratio
                ? newWidthNW / ratio
                : Math.max(50, prev.height - dy);
              newArea.x = prev.x + prev.width - newWidthNW;
              newArea.y = prev.y + prev.height - newHeightNW;
              newArea.width = newWidthNW;
              newArea.height = newHeightNW;
              break;
            case 'n':
              if (!ratio) {
                const newH = Math.max(50, prev.height - dy);
                newArea.y = prev.y + prev.height - newH;
                newArea.height = newH;
              }
              break;
            case 's':
              if (!ratio) {
                newArea.height = Math.max(
                  50,
                  Math.min(prev.height + dy, imageSize.height - prev.y)
                );
              }
              break;
            case 'e':
              newArea.width = Math.max(
                50,
                Math.min(prev.width + dx, imageSize.width - prev.x)
              );
              if (ratio) newArea.height = newArea.width / ratio;
              break;
            case 'w':
              const newW = Math.max(50, prev.width - dx);
              newArea.x = prev.x + prev.width - newW;
              newArea.width = newW;
              if (ratio) newArea.height = newArea.width / ratio;
              break;
          }

          // Clamp to image bounds
          newArea.x = Math.max(0, newArea.x);
          newArea.y = Math.max(0, newArea.y);
          newArea.width = Math.min(newArea.width, imageSize.width - newArea.x);
          newArea.height = Math.min(
            newArea.height,
            imageSize.height - newArea.y
          );

          return newArea;
        });
      }
    },
    [isDragging, isResizing, dragStart, imageSize, selectedRatio, aspectRatios]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleResetCrop = () => {
    setRotation(0);
    setSelectedRatio('free');
    const cropWidth = imageSize.width * 0.7;
    const cropHeight = imageSize.height * 0.7;
    setCropArea({
      x: (imageSize.width - cropWidth) / 2,
      y: (imageSize.height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    });
  };

  const handleApply = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!ctx || !img) return;

    const scaleX = img.naturalWidth / imageSize.width;
    const scaleY = img.naturalHeight / imageSize.height;

    // Use actual crop dimensions
    canvas.width = cropArea.width * scaleX;
    canvas.height = cropArea.height * scaleY;

    // Background color for rotation padding if needed
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (rotation !== 0) {
      // For proper rotation handling, we might need a more complex approach
      // but simple 90 degree increments on the source context is tricky
      // Simplified: Just draw the image rotated effectively
      // NOTE: This basic implementation assumes crop is post-rotation visual
      // For a proper implementation, we'd need to transform coordinates.
      // Given the complexity, let's keep it simple: draw image, then crop.
      // But here we are drawing a crop OF the image.
      
      // Let's create a temporary canvas for the full rotated image first
      const tempCanvas = document.createElement('canvas');
      if(rotation % 180 === 0) {
          tempCanvas.width = img.naturalWidth;
          tempCanvas.height = img.naturalHeight;
      } else {
          tempCanvas.width = img.naturalHeight;
          tempCanvas.height = img.naturalWidth;
      }
      
      const tempCtx = tempCanvas.getContext('2d');
      if(!tempCtx) return;
      
      tempCtx.save();
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate((rotation * Math.PI) / 180);
      tempCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      tempCtx.restore();
      
      // Now draw from temp canvas to final canvas
      // The imageSize was calculated based on the rotated visual aspect, 
      // so cropArea is relative to the displayed (rotated) image.
      // We need to map cropArea back to the tempCanvas dimensions.
      
      const displayScaleX = tempCanvas.width / imageSize.width;
      const displayScaleY = tempCanvas.height / imageSize.height;
      
      ctx.drawImage(
          tempCanvas,
          cropArea.x * displayScaleX,
          cropArea.y * displayScaleY,
          cropArea.width * displayScaleX,
          cropArea.height * displayScaleY,
          0,
          0,
          canvas.width,
          canvas.height
      );
      
    } else {
      ctx.drawImage(
        img,
        cropArea.x * scaleX,
        cropArea.y * scaleY,
        cropArea.width * scaleX,
        cropArea.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    const croppedImage = canvas.toDataURL('image/jpeg', 0.9);
    onApply(croppedImage);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-5xl overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b p-4 md:p-5">
          <div className="flex items-center justify-between">
            <DialogTitle>{t('title')}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Image Area */}
          <div
            ref={containerRef}
            className="flex min-h-[200px] flex-1 items-center justify-center overflow-hidden bg-gray-100 p-2 md:min-h-[500px] md:p-6"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            <div
              className="relative"
              style={{
                width: imageSize.width,
                height: imageSize.height,
              }}
            >
              {/* Image */}
              <img
                ref={imageRef}
                src={imageSrc || '/placeholder.svg'}
                alt="To crop"
                className="h-full w-full object-contain"
                style={{ transform: `rotate(${rotation}deg)` }}
                draggable={false}
              />

              {/* Dark overlay outside crop area */}
              <div className="pointer-events-none absolute inset-0">
                <div
                  className="absolute top-0 left-0 right-0 bg-black/50"
                  style={{ height: cropArea.y }}
                />
                <div
                  className="absolute right-0 bottom-0 left-0 bg-black/50"
                  style={{
                    height: imageSize.height - cropArea.y - cropArea.height,
                  }}
                />
                <div
                  className="absolute left-0 bg-black/50"
                  style={{
                    top: cropArea.y,
                    width: cropArea.x,
                    height: cropArea.height,
                  }}
                />
                <div
                  className="absolute right-0 bg-black/50"
                  style={{
                    top: cropArea.y,
                    width: imageSize.width - cropArea.x - cropArea.width,
                    height: cropArea.height,
                  }}
                />
              </div>

              {/* Crop Box */}
              <div
                className="absolute cursor-move border-2 border-primary"
                style={{
                  left: cropArea.x,
                  top: cropArea.y,
                  width: cropArea.width,
                  height: cropArea.height,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'drag')}
                onTouchStart={(e) => handleMouseDown(e, 'drag')}
              >
                {/* Grid lines */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute top-0 bottom-0 left-1/3 w-px bg-primary/30" />
                  <div className="absolute top-0 bottom-0 left-2/3 w-px bg-primary/30" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-primary/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-primary/30" />
                </div>

                {/* Handles */}
                <div
                  className="absolute -top-2 -left-2 h-4 w-4 cursor-nw-resize rounded-full border-2 border-primary bg-white md:h-3 md:w-3"
                  onMouseDown={(e) => handleMouseDown(e, 'nw')}
                  onTouchStart={(e) => handleMouseDown(e, 'nw')}
                />
                <div
                  className="absolute -top-2 -right-2 h-4 w-4 cursor-ne-resize rounded-full border-2 border-primary bg-white md:h-3 md:w-3"
                  onMouseDown={(e) => handleMouseDown(e, 'ne')}
                  onTouchStart={(e) => handleMouseDown(e, 'ne')}
                />
                <div
                  className="absolute -bottom-2 -left-2 h-4 w-4 cursor-sw-resize rounded-full border-2 border-primary bg-white md:h-3 md:w-3"
                  onMouseDown={(e) => handleMouseDown(e, 'sw')}
                  onTouchStart={(e) => handleMouseDown(e, 'sw')}
                />
                <div
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-full border-2 border-primary bg-white md:h-3 md:w-3"
                  onMouseDown={(e) => handleMouseDown(e, 'se')}
                  onTouchStart={(e) => handleMouseDown(e, 'se')}
                />
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t bg-background p-3 md:w-64 md:border-t-0 md:border-l md:gap-6 md:p-4">
            {/* Preset Ratios */}
            <div>
              <h3 className="mb-2 text-xs font-medium text-foreground md:mb-3 md:text-base">
                {t('presetRatios')}
              </h3>
              <div className="-mx-1 flex overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-3 md:px-0 md:pb-0 gap-2">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => setSelectedRatio(ratio.value)}
                    className={cn(
                      'shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs md:text-sm transition-colors',
                      selectedRatio === ratio.value
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted/50 border-input text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {ratio.label}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedRatio('free')}
                  className={cn(
                    'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs md:text-sm transition-colors',
                    selectedRatio === 'free'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {t('free')}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="mb-2 text-xs font-medium text-foreground md:mb-3 md:text-base">
                {t('actions')}
              </h3>
              <div className="flex gap-2 md:flex-col">
                <button
                  onClick={handleResetCrop}
                  className="bg-muted hover:bg-muted/80 text-muted-foreground flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs md:text-sm transition-colors md:flex-none md:justify-start"
                >
                  <RefreshCcw className="h-3 w-3 md:h-4 md:w-4" />
                  <span>{t('resetCrop')}</span>
                </button>
                <button
                  onClick={handleRotate}
                  className="bg-muted hover:bg-muted/80 text-muted-foreground flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs md:text-sm transition-colors md:flex-none md:justify-start"
                >
                  <RotateCw className="h-3 w-3 md:h-4 md:w-4" />
                  <span>{t('rotate')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t bg-background p-4">
          <Button variant="outline" onClick={onClose} className="px-6">
            {t('cancel')}
          </Button>
          <Button onClick={handleApply} className="px-6">
            {t('apply')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
