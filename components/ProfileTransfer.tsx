"use client";

import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useProfile } from '@/lib/profile';
import { exportProfile, importProfile, MAX_PROFILE_BYTES } from '@/lib/profile-transfer';
import type { UserProfile } from '@/lib/types';
import { ConfirmationModal } from './ConfirmationModal';

export function ProfileTransfer() {
  const { profile, replaceProfile, clearProfile } = useProfile();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<UserProfile | 'delete' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function download() {
    if (!profile) return;
    try {
      setError('');
      const url = URL.createObjectURL(new Blob([exportProfile(profile)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `hanstream-library-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage('Library export is ready to save.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Export failed.'); }
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
  function confirm() {
    try {
      if (pending === 'delete') { clearProfile(); setMessage('Saved library and watch history deleted from this device.'); }
      else if (pending) { replaceProfile(pending); setMessage('Library imported on this device.'); }
      setPending(null); setError('');
    } catch { setError('The library could not be saved.'); }
  }
  return <section className="glass-card p-6 space-y-4" aria-label="Manage saved library">
    <div><h2 className="heading text-xl">Manage library</h2><p className="text-sm text-secondary mt-2">Move your watchlist and history between devices with a library file. Importing replaces the library saved here.</p></div>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="glass-btn gap-2 px-4" disabled={!profile} onClick={download}><Download size={16} aria-hidden="true" />Export library</button>
      <button type="button" className="glass-btn gap-2 px-4" disabled={!profile} onClick={() => input.current?.click()}><Upload size={16} aria-hidden="true" />Import library</button>
      <button type="button" className="glass-btn gap-2 px-4" disabled={!profile} onClick={() => setPending('delete')}><Trash2 size={16} aria-hidden="true" />Delete saved data</button>
      <input ref={input} type="file" accept="application/json,.json" aria-label="Library file" className="sr-only" onChange={upload} />
    </div>
    {error && <p role="alert" className="text-sm">{error}</p>}{message && <p role="status" className="text-sm text-secondary">{message}</p>}
    <ConfirmationModal isOpen={pending !== null} onClose={() => setPending(null)} onConfirm={confirm} title={pending === 'delete' ? 'Delete saved library?' : 'Replace saved library?'} message={pending === 'delete' ? 'This removes the watchlist, ratings, progress, and watched episodes saved on this device. Export first if you want a backup.' : 'The imported watchlist and history will replace the library on this device. Your other devices will not change.'} confirmText={pending === 'delete' ? 'Delete library' : 'Import library'} />
  </section>;
}
