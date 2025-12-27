"use client";

import { cn } from "@/shared/lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

// Custom paragraph component that uses div for block-level content
const CustomParagraph = ({ children, node, ...props }: any) => {
  // Check if the paragraph node contains block-level child elements
  const hasBlockChildren = node?.children?.some((child: any) => {
    const blockTags = ['div', 'pre', 'code', 'blockquote', 'ul', 'ol', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    return child.tagName && blockTags.includes(child.tagName);
  });

  // If contains block elements, use div instead of p to avoid hydration error
  if (hasBlockChildren) {
    return <div {...props}>{children}</div>;
  }

  return <p {...props}>{children}</p>;
};

export const Response = memo(
  ({ className, components, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={{
        p: CustomParagraph,
        ...components,
      }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";