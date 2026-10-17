// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSourceConfig } from '../lib/server-config.mjs';
import { readHtml } from '../lib/html';

const settings = {
  STREAM_SOURCE_URL: 'https://stream.example',
  METADATA_SOURCE_URL: 'https://metadata.example/',
  EDITORIAL_SOURCE_URL: 'https://www.editorial.example',
  DETAILS_SOURCE_URL: 'https://details.example',
};
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('private source configuration', () => {
  it('uses private origins and supports editorial canonical links', () => {
    const config = getSourceConfig(settings);
    expect(config.streamOrigin).toBe('https://stream.example');
    expect(config.metadataOrigin).toBe('https://metadata.example');
    expect(config.allowedOrigins).toContain('https://editorial.example');
    expect(Object.keys(settings).some(name => name.startsWith('NEXT_PUBLIC_'))).toBe(false);
  });

  it('requires configuration without exposing configured values in errors', () => {
    expect(() => getSourceConfig({ ...settings, STREAM_SOURCE_URL: '' })).toThrow('Missing server environment variable: STREAM_SOURCE_URL');
    for (const value of ['http://stream.example', 'https://user:private-value@stream.example', 'https://stream.example/?token=private-value', 'https://stream.example/path', 'https://stream.example:8443']) {
      try { getSourceConfig({ ...settings, STREAM_SOURCE_URL: value }); throw new Error('Accepted an invalid source'); }
      catch (error) { expect((error as Error).message).toBe('Invalid HTTPS origin in server environment variable: STREAM_SOURCE_URL'); }
    }
  });

  it('refuses browser access', () => {
    vi.stubGlobal('window', {});
    expect(() => getSourceConfig(settings)).toThrow('Source configuration is server-only');
  });

  it('allows configured hosts and blocks unconfigured hosts and cross-source redirects', async () => {
    for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
    const request = vi.fn().mockResolvedValueOnce(new Response('<html>Public page</html>', { headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: settings.METADATA_SOURCE_URL } }));
    vi.stubGlobal('fetch', request);
    expect(await readHtml('https://stream.example/')).toContain('Public page');
    await expect(readHtml('https://unconfigured.example/')).rejects.toThrow('Invalid source URL');
    expect(request).toHaveBeenCalledTimes(1);
    await expect(readHtml('https://stream.example/')).rejects.toThrow('temporarily unavailable');
  });
});
