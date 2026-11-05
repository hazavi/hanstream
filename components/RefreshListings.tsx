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
      if (attempt >= 5) return;
      timer = setTimeout(() => { attempt++; router.refresh(); schedule(); }, [2000,5000,10000,20000,30000][attempt]);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled,router]);
  return null;
}
