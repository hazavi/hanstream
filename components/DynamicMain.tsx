import type { ReactNode } from "react";

export function DynamicMain({ children }: { children: ReactNode }) {
  return <main className="site-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pb-10 pt-8 sm:pt-10">{children}</main>;
}
