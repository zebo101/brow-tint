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
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Physics animation state
  const [springY, setSpringY] = useState(0);
  const [springX, setSpringX] = useState(0);
  const velocityRef = useRef(0);
  const velocityXRef = useRef(0);
  const lastDragYRef = useRef(0);
  const lastDragXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  
  // Drag threshold to trigger theme switch (in pixels)
  const DRAG_THRESHOLD = 80;
  const MAX_DRAG = 180;
  const MAX_RADIUS = 180;
  
  // Spring physics constants
  const SPRING_STIFFNESS = 0.12;
  const SPRING_DAMPING = 0.82;
  const SWAY_STIFFNESS = 0.07;
  const SWAY_DAMPING = 0.86;
  const VELOCITY_SCALE = 0.45;
  const VELOCITY_CLAMP = 28;

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
      velocityRef.current = Math.max(
        -VELOCITY_CLAMP,
        Math.min(VELOCITY_CLAMP, velocityRef.current)
      );

      const springForceX = -springX * SWAY_STIFFNESS;
      velocityXRef.current += springForceX;
      velocityXRef.current *= SWAY_DAMPING;
      velocityXRef.current = Math.max(
        -VELOCITY_CLAMP,
        Math.min(VELOCITY_CLAMP, velocityXRef.current)
      );

      const newY = springY + velocityRef.current;
      const newX = springX + velocityXRef.current;
      setSpringY(newY);
      setSpringX(newX);

      if (
        Math.abs(velocityRef.current) > 0.1 ||
        Math.abs(newY) > 0.1 ||
        Math.abs(velocityXRef.current) > 0.1 ||
        Math.abs(newX) > 0.1
      ) {
        animationFrameRef.current = requestAnimationFrame(spring);
      } else {
        setSpringY(0);
        setSpringX(0);
        velocityRef.current = 0;
        velocityXRef.current = 0;
        animationFrameRef.current = null;
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(spring);
  }, [springY, springX]);

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

  const handleStart = useCallback((clientY: number, clientX: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setIsDragging(true);
    startYRef.current = clientY;
    startXRef.current = clientX;
    lastDragYRef.current = 0;
    lastDragXRef.current = 0;
    lastTimeRef.current = performance.now();
    setDragY(springY);
    setDragX(springX);
    setSpringY(0);
    setSpringX(0);
    velocityRef.current = 0;
    velocityXRef.current = 0;
  }, [springY, springX]);

  const handleMove = useCallback((clientY: number, clientX: number) => {
    if (!isDragging) return;
    
    const now = performance.now();
    const deltaTime = now - lastTimeRef.current;
    
    const deltaY = clientY - startYRef.current;
    const deltaX = clientX - startXRef.current;
    const distance = Math.hypot(deltaX, deltaY);
    const scale = distance > MAX_RADIUS ? MAX_RADIUS / distance : 1;
    const clampedDrag = deltaY * scale;
    const clampedSway = deltaX * scale;
    
    if (deltaTime > 0) {
      const nextVelocity =
        ((clampedDrag - lastDragYRef.current) / deltaTime) * 16 * VELOCITY_SCALE;
      velocityRef.current =
        velocityRef.current * 0.35 + nextVelocity * 0.65;

      const nextVelocityX =
        ((clampedSway - lastDragXRef.current) / deltaTime) * 16 * 0.25;
      velocityXRef.current =
        velocityXRef.current * 0.35 + nextVelocityX * 0.65;
    }
    
    lastDragYRef.current = clampedDrag;
    lastDragXRef.current = clampedSway;
    lastTimeRef.current = now;
    setDragY(clampedDrag);
    setDragX(clampedSway);
  }, [isDragging]);

  const handleEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    if (dragY >= DRAG_THRESHOLD) {
      triggerThemeChange();
    }
    
    setSpringY(dragY);
    setSpringX(dragX);
    setDragY(0);
    setDragX(0);
    
    setTimeout(() => {
      animateSpring();
    }, 0);
  }, [isDragging, dragY, dragX, triggerThemeChange, animateSpring]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY, e.clientX);
  }, [handleStart]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY, e.clientX);
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
    handleStart(e.touches[0].clientY, e.touches[0].clientX);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY, e.touches[0].clientX);
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
  const displayX = isDragging ? dragX : springX;
  const positiveY = Math.max(0, displayY);
  // Reduced base length to 20px (was 30px)
  const baseCordLength = 20;
  const cordLength = Math.max(10, baseCordLength + displayY);
  const ropeSlack = Math.min(14, 4 + positiveY * 0.08);
  const ropeEndX = 6;
  const swayAbs = Math.min(12, Math.abs(displayX) * 0.3);
  const control1X = 6 + displayX * 0.25;
  const control1Y = Math.max(0, cordLength * 0.36 + ropeSlack * 0.15);
  const control2X = 6 + displayX * 0.75;
  const control2Y = Math.max(0, cordLength * 0.82 + ropeSlack * 0.4 + swayAbs);
  const ropePath = `M 6 -10 C ${control1X} ${control1Y} ${control2X} ${control2Y} ${ropeEndX} ${cordLength}`;
  
  const ropeColor = isDarkMode ? "#e2e8f0" : "#475569"; 
  const ropeBaseColor = isDarkMode ? "#64748b" : "#94a3b8";
  
  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex flex-col items-center select-none overflow-visible z-50 group", // Added group class
        // Moved up slightly with negative margin
        "-mt-4",
        className
      )}
      style={{ height: 56 }}
    >
      <div
        className="absolute top-0 left-1/2 overflow-visible"
        style={{ transform: `translate3d(calc(-50% + ${displayX}px), 0, 0)` }}
      >
        {/* Rope SVG */}
        <svg 
          className="overflow-visible"
          width="12" 
          height={cordLength + 12}
          style={{ pointerEvents: 'none' }}
        >
          <defs>
            <pattern id="rope-pattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
               {/* Thinner diagonal lines to create twisted effect */}
               <path d="M-1,3 L5,-1 M-1,7 L7,-1" stroke={ropeColor} strokeWidth="1" opacity="0.9" />
            </pattern>
          </defs>
          
          {/* Rope Group - filter removed to fix local dev rendering issues */}
          <g>
            {/* Base rope Shape (background) */}
            <path
              d={ropePath}
              stroke={ropeBaseColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            
            {/* Texture overlay */}
            <path
              d={ropePath}
              stroke="url(#rope-pattern)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* The Knot at the bottom of the rope (hidden behind the bulb) */}
          <g transform={`translate(${ropeEndX}, ${cordLength})`} opacity="0">
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
            "absolute left-1/2 cursor-grab active:cursor-grabbing",
            "w-12 h-12",
            "flex items-center justify-center",
            "transition-transform duration-100",
            "z-10",
            isDragging && "scale-110"
          )}
          style={{
            top: cordLength - 6, // Slightly reduce overlap with rope end
            transform: "translate3d(-50%, 0, 0)",
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
