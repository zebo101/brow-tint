import type { ReactNode } from "react";

interface ScrollAnimationProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  stagger?: boolean;
}

export function ScrollAnimation({
  children,
  className = "",
}: ScrollAnimationProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
