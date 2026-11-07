"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

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
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-secondary">
      {items.map((item, index) => (
        <div key={index} className="flex min-w-0 max-w-full items-center gap-2 [overflow-wrap:anywhere]">
          {item.href && !item.isActive ? (
            <Link
              href={item.href}
              className="hover:text-primary transition-colors font-medium"
            >
              {item.label}
            </Link>
          ) : (
            <span aria-current={item.isActive ? 'page' : undefined}
              className={
                item.isActive ? "text-primary font-medium" : "text-secondary"
              }
            >
              {item.label}
            </span>
          )}

          {index < items.length - 1 && (
            <ChevronRight size={14} className="breadcrumb-separator" strokeWidth={2} aria-hidden="true"/>
          )}
        </div>
      ))}
    </nav>
  );
}
