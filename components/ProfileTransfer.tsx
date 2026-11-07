"use client";

import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useProfile } from '@/lib/profile';
import { importProfile, MAX_PROFILE_BYTES } from '@/lib/profile-transfer';
import { saveLibrary } from '@/lib/library-export';
import type { UserProfile } from '@/lib/types';
import { ConfirmationModal } from './ConfirmationModal';

export function ProfileTransfer() {
  const { profile, replaceProfile, clearProfile, persistenceError } = useProfile();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<UserProfile | 'delete' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const exportBusy = useRef(false);
  async function download() {
    if (!profile || exportBusy.current) return;
    exportBusy.current = true; setExporting(true);
    try {
      setError(''); setMessage('');
      const result = await saveLibrary(profile);
      if (result === 'saved') setMessage('Library exported to the location you chose.');
      if (result === 'downloaded') setMessage('Library download started. To choose a location each time, enable your browser\'s ask-where-to-save downloads setting.');
    } catch (error) { setError(error instanceof Error ? error.message : typeof error === 'string' ? error : 'Export failed.'); }
    finally { exportBusy.current = false; setExporting(false); }
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    setMessage(''); setError('');
    try {
      if (file.size > MAX_PROFILE_BYTES) throw new Error('Library files must be smaller than 1 MB.');
      setPending(importProfile(await file.text()));
    } catch (error) { setError(error instanceof Error ? error.message : 'Import failed.'); }
  }
  async function confirm() {
    try {
      if (pending === 'delete') { await clearProfile(); setMessage('Saved library and watch history deleted from this device.'); }
      else if (pending) { await replaceProfile(pending); setMessage('Library imported on this device.'); }
      setPending(null); setError('');
    } catch { setError('The library could not be saved.'); }
  }
  return <section className="glass-card p-6 space-y-4" aria-label="Manage saved library">
    <div><h2 className="heading text-xl">Manage library</h2><p className="text-sm text-secondary mt-2">Move your watchlist and history between devices with a library file. Importing replaces the library saved here.</p></div>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="glass-btn gap-2 px-4" disabled={!profile || exporting} onClick={download}><Download size={16} aria-hidden="true" />{exporting ? 'Saving library…' : 'Export library'}</button>
      <button type="button" className="glass-btn gap-2 px-4" disabled={!profile} onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" />Import library</button>
      <button type="button" className="glass-btn danger-button gap-2 px-4" disabled={!profile} onClick={() => setPending('delete')}><Trash2 size={16} aria-hidden="true" />Delete saved data</button>
      <input ref={input} type="file" accept="application/json,.json" aria-label="Library file" className="sr-only" onChange={upload} />
    </div>
    {persistenceError && <p role="alert" className="text-sm">{persistenceError}</p>}{error && <p role="alert" className="text-sm">{error}</p>}{message && <p role="status" className="text-sm text-secondary">{message}</p>}
    <ConfirmationModal isOpen={pending !== null} onClose={() => setPending(null)} onConfirm={confirm} title={pending === 'delete' ? 'Delete saved library?' : 'Replace saved library?'} message={pending === 'delete' ? 'This removes the watchlist, ratings, progress, and watched episodes saved on this device. Export first if you want a backup.' : 'The imported watchlist and history will replace the library on this device. Your other devices will not change.'} confirmText={pending === 'delete' ? 'Delete library' : 'Import library'} />
  </section>;
}
