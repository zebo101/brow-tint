import Image from 'next/image';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Logos({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className={`mx-auto max-w-5xl px-6`}>
        <ScrollAnimation>
          <p className="text-md text-center font-medium">{section.title}</p>
        </ScrollAnimation>
        <ScrollAnimation delay={0.2}>
          <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-16 sm:gap-y-12">
            {section.items?.map((item, idx) => {
              const imageSrc = item.image?.src ?? '';
              const imageWidth = item.image?.width ?? 120;
              const imageHeight = item.image?.height ?? 32;
              // React 和 Tailwind CSS 保持原色，其他 logo 在暗色模式下反色
              const shouldInvert =
                !imageSrc.includes('react.svg') &&
                !imageSrc.includes('tailwindcss.svg');
              if (!imageSrc) {
                return null;
              }
              return (
                <Image
                  key={idx}
                  className={cn(
                    'h-8 w-auto',
                    shouldInvert && 'dark:invert'
                  )}
                  src={imageSrc}
                  alt={item.image?.alt ?? ''}
                  width={imageWidth}
                  height={imageHeight}
                  sizes="(max-width: 768px) 100vw, 120px"
                  loading="lazy"
                />
              );
            })}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}
