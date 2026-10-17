"use client";

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="glass-card rounded-2xl p-8 space-y-4 text-center">
    <h1 className="text-xl font-semibold heading">This page is temporarily unavailable</h1>
    <p className="text-sm text-secondary">The drama source couldn&apos;t be loaded. Try again in a moment.</p>
    <button type="button" onClick={reset} className="glass-btn px-4 py-2 text-sm">Try again</button>
  </div>;
}
