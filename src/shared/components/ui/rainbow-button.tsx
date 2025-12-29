import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/shared/lib/utils';

interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  showRainbow?: boolean;
}

export function RainbowButton({
  children,
  className,
  asChild = false,
  showRainbow = false,
  ...props
}: RainbowButtonProps) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(
        'group relative inline-flex h-11 min-w-fit cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-white/10 whitespace-nowrap px-4 py-2 text-base font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 sm:px-8',

        // before styles - 彩虹光晕效果
        showRainbow && 'before:pointer-events-none before:absolute before:bottom-[-20%] before:left-1/2 before:z-[-1] before:h-[20%] before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,hsl(var(--color-1)),hsl(var(--color-5)),hsl(var(--color-3)),hsl(var(--color-4)),hsl(var(--color-2)))] before:bg-[length:200%] before:[filter:blur(calc(0.8*1rem))] before:opacity-100 before:content-[""]',

        // 白天模式样式 - 极致 Linear 黑金风格
        'bg-zinc-950 text-white shadow-[0_1px_1px_rgba(0,0,0,0.05),0_4px_6px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.15)]',
        // 增加一个微弱的渐变叠加以提升质感
        '[background-image:linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0)_100%)]',
        'hover:bg-zinc-900 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_8px_rgba(0,0,0,0.2)]',

        // 暗色模式样式 - 金属流银风格 (Metal Silver)
        'dark:border-white/20',
        'dark:bg-[linear-gradient(180deg,#ffffff_0%,#e4e4e7_100%)]',
        'dark:text-black dark:shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]',
        'dark:hover:bg-[linear-gradient(180deg,#f4f4f5_0%,#d4d4d8_100%)]',

        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

