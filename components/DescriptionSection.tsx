"use client";

import { useState, useRef, useEffect } from "react";

interface DescriptionSectionProps {
  description: string;
}

export function DescriptionSection({ description }: DescriptionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkTextOverflow = () => {
      if (contentRef.current) {
        const element = contentRef.current;
        // Check if element has scrollable content (scrollHeight > clientHeight)
        // when line-clamped
        setShowReadMore(element.scrollHeight > element.clientHeight);
      }
    };

    // Add a small delay to ensure the element is fully rendered
    const timer = setTimeout(checkTextOverflow, 100);

    // Also check on window resize in case layout changes
    window.addEventListener("resize", checkTextOverflow);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", checkTextOverflow);
    };
  }, [description]);

  return (
    <div className="bg-transparent backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-xl p-4">
      <div
        ref={contentRef}
        className={`prose prose-neutral dark:prose-invert max-w-none text-secondary leading-relaxed text-sm ${
          !isExpanded ? "line-clamp-8" : ""
        }`}
        dangerouslySetInnerHTML={{ __html: description }}
        style={
          !isExpanded
            ? {
                display: "-webkit-box",
                WebkitLineClamp: 8,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }
            : {}
        }
      />
      {showReadMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-accent hover:text-accent-hover hover:cursor-pointer text-[13px] mt-2 transition-colors font-medium"
        >
          {isExpanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
