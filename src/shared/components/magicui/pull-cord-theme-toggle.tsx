"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/shared/lib/utils";
import { useTheme } from "next-themes";
import Image from "next/image";
import { useTranslations } from "next-intl";

type PullCordThemeToggleProps = {
  className?: string;
};

export const PullCordThemeToggle = ({ className }: PullCordThemeToggleProps) => {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('common.theme');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);
  
  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Physics animation state
  const [springY, setSpringY] = useState(0);
  const velocityRef = useRef(0);
  const lastDragYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number>(0);
  
  // Drag threshold to trigger theme switch (in pixels)
  const DRAG_THRESHOLD = 80;
  const MAX_DRAG = 120;
  
  // Spring physics constants
  const SPRING_STIFFNESS = 0.15;
  const SPRING_DAMPING = 0.75;
  const VELOCITY_SCALE = 0.3;

  useEffect(() => {
    setMounted(true);
    setIsDarkMode(theme === "dark");
  }, [theme]);

  // Spring physics animation
  const animateSpring = useCallback(() => {
    const spring = () => {
      const springForce = -springY * SPRING_STIFFNESS;
      velocityRef.current += springForce;
      velocityRef.current *= SPRING_DAMPING;
      
      const newY = springY + velocityRef.current;
      setSpringY(newY);
      
      if (Math.abs(velocityRef.current) > 0.1 || Math.abs(newY) > 0.1) {
        animationFrameRef.current = requestAnimationFrame(spring);
      } else {
        setSpringY(0);
        velocityRef.current = 0;
        animationFrameRef.current = null;
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(spring);
  }, [springY]);

  const triggerThemeChange = useCallback(async () => {
    if (!handleRef.current) return;

    setIsAnimating(true);
    
    // Fallback for browsers that don't support View Transitions
    if (!document.startViewTransition) {
      const dark = document.documentElement.classList.toggle("dark");
      setTheme(dark ? "dark" : "light");
      setIsDarkMode(dark);
      setTimeout(() => setIsAnimating(false), 700);
      return;
    }
    
    await document.startViewTransition(() => {
      flushSync(() => {
        const dark = document.documentElement.classList.toggle("dark");
        setTheme(dark ? "dark" : "light");
        setIsDarkMode(dark);
      });
    }).ready;

    const { top, left, width, height } = handleRef.current.getBoundingClientRect();
    const y = top + height / 2;
    const x = left + width / 2;

    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRad}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 700,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)",
      }
    );

    setTimeout(() => setIsAnimating(false), 700);
  }, [setTheme]);

  const handleStart = useCallback((clientY: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setIsDragging(true);
    startYRef.current = clientY;
    lastDragYRef.current = 0;
    lastTimeRef.current = performance.now();
    setDragY(springY);
    setSpringY(0);
    velocityRef.current = 0;
  }, [springY]);

  const handleMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    
    const now = performance.now();
    const deltaTime = now - lastTimeRef.current;
    
    const deltaY = clientY - startYRef.current;
    const clampedDrag = Math.min(Math.max(0, deltaY), MAX_DRAG);
    
    if (deltaTime > 0) {
      velocityRef.current = ((clampedDrag - lastDragYRef.current) / deltaTime) * 16 * VELOCITY_SCALE;
    }
    
    lastDragYRef.current = clampedDrag;
    lastTimeRef.current = now;
    setDragY(clampedDrag);
  }, [isDragging]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    if (dragY >= DRAG_THRESHOLD) {
      triggerThemeChange();
    }
    
    setSpringY(dragY);
    setDragY(0);
    
    setTimeout(() => {
      animateSpring();
    }, 0);
  }, [isDragging, dragY, triggerThemeChange, animateSpring]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
  }, [handleStart]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientY);
  }, [handleMove]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  if (!mounted) {
    return null;
  }

  const displayY = isDragging ? dragY : springY;
  // Reduced base length to 20px (was 30px)
  const baseCordLength = 20;
  const cordLength = baseCordLength + Math.max(0, displayY);
  
  const ropeColor = isDarkMode ? "#e2e8f0" : "#475569"; 
  const ropeBaseColor = isDarkMode ? "#64748b" : "#94a3b8";
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex flex-col items-center select-none z-50 group", // Added group class
        // Moved up slightly with negative margin
        "-mt-4",
        className
      )}
      style={{ height: 50 + Math.max(0, displayY) }}
    >
      {/* Rope SVG */}
      <svg 
        className="absolute top-0 left-1/2 -translate-x-1/2 overflow-visible"
        width="12" 
        height={cordLength + 12}
        style={{ pointerEvents: 'none' }}
      >
        <defs>
          <pattern id="rope-pattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
             {/* Thinner diagonal lines to create twisted effect */}
             <path d="M-1,3 L5,-1 M-1,7 L7,-1" stroke={ropeColor} strokeWidth="1" opacity="0.9" />
          </pattern>
          {/* Filter for slight wiggle/wave effect */}
          <filter id="pull-cord-wiggle">
            <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={isDragging ? 0 : 2} />
          </filter>
        </defs>
        
        {/* Rope Group with potential filter */}
        <g filter="url(#pull-cord-wiggle)">
          {/* Base rope Shape (background) */}
          <line
            x1="6"
            y1="-10"
            x2="6"
            y2={cordLength}
            stroke={ropeBaseColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          
          {/* Texture overlay */}
          <rect
            x="4.5"
            y="-10"
            width="3"
            height={cordLength + 10}
            fill="url(#rope-pattern)"
          />
        </g>

        {/* The Knot at the bottom of the rope */}
        <g transform={`translate(6, ${cordLength})`}>
             <circle cx="0" cy="-1.5" r="2.5" fill={ropeBaseColor} />
             <circle cx="0" cy="-1.5" r="2.5" fill="url(#rope-pattern)" />
             <path 
                d="M-2,-3 Q0,0 2,-3 Q3,-2 0,2 Q-3,-2 -2,-3" 
                fill={ropeBaseColor} 
                stroke={ropeColor}
                strokeWidth="0.5"
             />
        </g>
      </svg>

      {/* Draggable Handle */}
      <div
        ref={handleRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={cn(
          "absolute cursor-grab active:cursor-grabbing",
          "w-12 h-12",
          "flex items-center justify-center",
          "transition-transform duration-100",
          isDragging && "scale-110"
        )}
        style={{
          top: cordLength - 6, // Adjusted to overlap knot better
          transition: isDragging ? "transform 0.1s" : "none",
          touchAction: "none"
        }}
        role="button"
        tabIndex={0}
        aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            triggerThemeChange();
          }
        }}
      >
        <Image 
          src="/imgs/bg/dp.svg" 
          alt="Theme Toggle Handle" 
          width={40} 
          height={40}
          className="w-full h-full object-contain drop-shadow-lg dark:invert"
          draggable={false}
        />
      </div>
      
      {/* Tooltip hint */}
      <div 
        className={cn(
          "absolute top-full mt-2 left-1/2 -translate-x-1/2",
          "bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md",
          "opacity-0 transition-opacity duration-200 pointer-events-none whitespace-nowrap",
          "group-hover:opacity-100",
          isDragging && "opacity-0" // Hide when dragging
        )}
      >
        {t('pull_to_toggle')}
      </div>
    </div>
  );
};
