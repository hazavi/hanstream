"use client";
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';

export function DesktopUpdates() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => { void update?.close().catch(() => {}); }, [update]);
  if (process.env.NEXT_PUBLIC_DESKTOP_UPDATES !== '1') return null;
  async function check() {
    setBusy(true); setMessage('Checking for a signed update...');
    try {
      const result = await (await import('@tauri-apps/plugin-updater')).check();
      setUpdate(result); setMessage(result ? `Version ${result.version} is available.` : 'You are up to date.');
    } catch { setMessage('Update check failed. Try again later.'); }
    finally { setBusy(false); }
  }
  async function install() {
    if (!update) return;
    setBusy(true); setMessage('Downloading and verifying the update...');
    try { await update.downloadAndInstall(); setMessage('Update installed. Reopen the app to finish.'); setUpdate(null); }
    catch { setMessage('The update could not be verified or installed. Reopen the app and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="glass-card p-6 space-y-3"><h2 className="heading text-xl">Desktop updates</h2><button type="button" className="glass-btn gap-2 px-4" disabled={busy} onClick={update ? install : check}><RefreshCw size={16} aria-hidden="true" />{update ? 'Install signed update' : 'Check for updates'}</button><p role="status" className="text-sm text-secondary">{message}</p></section>;
}
