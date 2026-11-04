import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';
import { contentSecurityPolicy } from '../lib/security-policy.mjs';

export function staticPagePolicy(html, apiOrigin) {
  const $ = load(html);
  const hashes = new Set();
  $('script:not([src])').each((_, element) => {
    hashes.add(`'sha256-${createHash('sha256').update($(element).html() || '').digest('base64')}'`);
  });
  return contentSecurityPolicy({ apiOrigin, scriptHashes: [...hashes], meta: true });
}

/** Pages has no app server to set headers; apply a hashed policy in each HTML head. */
export async function securePages(directory, apiOrigin) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await securePages(file, apiOrigin);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      const policy = staticPagePolicy(html, apiOrigin).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
      await writeFile(file, html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}"/><meta name="referrer" content="no-referrer"/>`));
    }
  }
}
