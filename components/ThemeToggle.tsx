"use client";
import { useCallback, useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  // Apply theme to document
  const apply = useCallback((t: 'light' | 'dark') => {
    if (t === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  // Initialize
  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('hanstream-theme')) as 'light' | 'dark' | null;
    const initial: 'light' | 'dark' = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark');
    setTheme(initial);
    apply(initial);
    setMounted(true);

    // Sync across tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hanstream-theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setTheme(e.newValue);
        apply(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [apply]);

  // Toggle handler
  const toggle = () => {
    const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    apply(next);
    try { localStorage.setItem('hanstream-theme', next); } catch {}
  };

  if (!mounted) {
    return (
      <button aria-label="Toggle theme" className="p-2 rounded-lg opacity-0 pointer-events-none" />
    );
  }

  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="p-2 rounded-lg theme-toggle-btn hover:bg-white/50 hover:backdrop-blur-sm hover:cursor-pointer dark:hover:bg-white/10 transition-all duration-300"
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  );
}
