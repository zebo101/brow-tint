import { cn } from '@/shared/lib/utils';

export function HeroAppFrame({
  url,
  children,
  className,
}: {
  url: string;
  fallbackImage?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('animate-hero-frame-in', className)}>
      <div className="relative mx-auto max-w-[1440px]">
        <div className="relative">
          <div className="bg-background/95 dark:bg-background/80 relative overflow-hidden rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.15),0_0_80px_-20px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),0_0_80px_-20px_rgba(0,0,0,0.3)]">
            <div className="border-border/50 bg-muted/50 dark:border-border/30 dark:bg-muted/20 flex items-center justify-between border-b px-4 py-3 backdrop-blur-sm sm:px-6">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500 shadow-sm dark:bg-red-500/80" />
                <div className="size-3 rounded-full bg-yellow-500 shadow-sm dark:bg-yellow-500/80" />
                <div className="size-3 rounded-full bg-green-500 shadow-sm dark:bg-green-500/80" />
              </div>

              <div className="bg-background/80 border-border/30 dark:border-border/20 dark:bg-background/40 hidden items-center gap-2 rounded-lg border px-4 py-1.5 sm:flex sm:min-w-[300px] md:min-w-[400px]">
                <svg
                  className="text-muted-foreground size-4"
                  fill="none"
                  strokeWidth="2"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v6m0 0 3-3m-3 3-3-3"
                  />
                </svg>
                <span className="text-muted-foreground flex-1 truncate text-xs sm:text-sm">
                  {url}
                </span>
                <svg
                  className="size-4 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9Z" />
                </svg>
              </div>

              <div className="w-[52px]" />
            </div>

            <div className="relative">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
