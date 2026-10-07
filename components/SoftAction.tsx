import Link from "next/link";
import type { ReactNode } from "react";

/** Adapted from the restrained button treatment in 21st.dev's Minimal Button. */
export function SoftAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="soft-action group">
      <span>{children}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition-transform group-hover:translate-x-0.5">
        <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
