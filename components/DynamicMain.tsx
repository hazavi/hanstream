"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function DynamicMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isEpisodePage = pathname.includes("/episode/");

  return (
    <main
      className={`flex-1 max-w-7xl w-full mx-auto px-6 pb-10 overflow-x-hidden ${
        isEpisodePage ? "pt-4" : "pt-24"
      }`}
    >
      {children}
    </main>
  );
}
