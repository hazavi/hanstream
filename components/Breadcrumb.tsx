"use client";

import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm text-secondary">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {item.href && !item.isActive ? (
            <Link
              href={item.href}
              className="hover:text-primary transition-colors font-medium"
            >
              {item.label}
            </Link>
          ) : (
            <span
              className={
                item.isActive ? "text-primary font-medium" : "text-secondary"
              }
            >
              {item.label}
            </span>
          )}

          {index < items.length - 1 && (
            <svg
              className="w-4 h-4 text-tertiary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </div>
      ))}
    </nav>
  );
}
