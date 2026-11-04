"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Retry a partial server render without making visitors reload the page. */
export function RefreshListings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      if (attempt >= 3) return;
      timer = setTimeout(() => { attempt++; router.refresh(); schedule(); }, [12_000,25_000,50_000][attempt]);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled,router]);
  return null;
}
