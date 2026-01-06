'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

import { AnimatedThemeToggler } from '@/shared/components/magicui/animated-theme-toggler';
import { PullCordThemeToggle } from '@/shared/components/magicui/pull-cord-theme-toggle';
import { Button } from '@/shared/components/ui/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/shared/components/ui/toggle-group';

const SunIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
    aria-hidden
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

const MoonIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
    aria-hidden
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

const MonitorIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={className}
    aria-hidden
  >
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </svg>
);

export function ThemeToggler({
  type = 'icon',
  className,
}: {
  type?: 'icon' | 'button' | 'toggle' | 'pull-cord';
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const handleThemeChange = (value: string) => {
    setTheme(value);
  };

  if (!mounted) {
    return null;
  }

  if (type === 'button') {
    return (
      <Button variant="outline" size="sm" className="hover:bg-primary/10">
        <SunIcon />
      </Button>
    );
  } else if (type === 'toggle') {
    return (
      <ToggleGroup
        type="single"
        className={` ${className}`}
        value={theme}
        onValueChange={handleThemeChange}
        variant="outline"
      >
        <ToggleGroupItem
          value="light"
          onClick={() => setTheme('light')}
          aria-label="Switch to light mode"
        >
          <SunIcon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          onClick={() => setTheme('dark')}
          aria-label="Switch to dark mode"
        >
          <MoonIcon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="system"
          onClick={() => setTheme('system')}
          aria-label="Switch to system mode"
        >
          <MonitorIcon />
        </ToggleGroupItem>
      </ToggleGroup>
    );
  } else if (type === 'pull-cord') {
    return <PullCordThemeToggle className={className} />;
  }

  return <AnimatedThemeToggler className={className} />;
}
