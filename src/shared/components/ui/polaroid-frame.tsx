import { cn } from '@/shared/lib/utils';

/**
 * Visual polaroid shell — white photo paper with rounded corners, soft
 * shadow, and an optional handwritten caption strip at the bottom. The
 * `children` slot is the photo area; the consumer supplies its own
 * aspect ratio + image.
 *
 * Used on the brow-tint studio (interactive uploader) and the editorial
 * hero (decorative, tilted). Keeping the shell here de-duplicates the
 * paper styling so future placements stay consistent.
 */
export function PolaroidFrame({
  children,
  caption,
  className,
}: {
  children: React.ReactNode;
  caption?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-sm bg-white p-3 pb-8 shadow-lg ring-1 ring-black/5',
        className
      )}
    >
      {children}
      {caption && (
        <p className="text-default-400 mt-4 text-center font-display text-[13px] italic tracking-wide">
          {caption}
        </p>
      )}
    </div>
  );
}
