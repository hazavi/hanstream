"use client";
import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

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
    let stored: string | null = null;
    try { stored = localStorage.getItem('hanstream-theme'); } catch { /* The theme works in memory when browser storage is blocked. */ }
    const initial = stored === 'light' ? 'light' : 'dark';
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
      <button type="button" aria-label="Toggle theme" disabled className="outline-icon-button theme-toggle-btn"><Moon size={17} aria-hidden="true"/></button>
    );
  }

  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="outline-icon-button theme-toggle-btn"
    >
      {isDark ? <Moon size={17} aria-hidden="true"/> : <Sun size={17} aria-hidden="true"/>}
    </button>
  );
}
