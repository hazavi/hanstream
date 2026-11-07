import { isDesktop, nativeInvoke } from './native';
import { exportProfile } from './profile-transfer';
import type { UserProfile } from './types';

type WritableFile = {write(content: string): Promise<void>; close(): Promise<void>; abort(): Promise<void>};
type SavePicker = (options: {suggestedName: string; excludeAcceptAllOption: boolean; types: {description: string; accept: Record<string, string[]>}[]}) => Promise<{createWritable(): Promise<WritableFile>}>;

/** Paths stay with the OS/browser picker; this API never accepts a filesystem path. */
export async function saveLibrary(profile: UserProfile): Promise<'saved' | 'cancelled' | 'downloaded'> {
  const content = exportProfile(profile);
  const filename = `hanstream-library-${new Date().toISOString().slice(0, 10)}.json`;
  if (isDesktop()) {
    return await nativeInvoke<boolean>('library_export', {content, filename}) ? 'saved' : 'cancelled';
  }
  const picker = (window as unknown as {showSaveFilePicker?: SavePicker}).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker.call(window, {
        suggestedName: filename, excludeAcceptAllOption: true,
        types: [{description: 'HanStream library', accept: {'application/json': ['.json']}}],
      });
      const file = await handle.createWritable();
      try { await file.write(content); await file.close(); }
      catch (error) { await file.abort().catch(() => {}); throw error; }
      return 'saved';
    } catch (error) {
      if ((error as {name?: string})?.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  // Browsers without a save picker control the location through download settings.
  const url = URL.createObjectURL(new Blob([content], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  try { document.body.append(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10_000); }
  return 'downloaded';
}
