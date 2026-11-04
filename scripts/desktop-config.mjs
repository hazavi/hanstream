import { contentSecurityPolicy } from '../lib/security-policy.mjs';
import { getPagesConfig } from './pages-config.mjs';

/** @param {Record<string, string | undefined>} [env] */
export function desktopConfig(env = process.env) {
  const { api } = getPagesConfig({ NEXT_PUBLIC_API_BASE_URL: env.DESKTOP_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL, GITHUB_ACTIONS: 'true' });
  if (!api) throw new Error('Set DESKTOP_API_BASE_URL to the public HTTPS backend origin.');
  const signed = env.DESKTOP_SIGNED_UPDATES === '1';
  const csp = contentSecurityPolicy({ apiOrigin: api, desktop: true });
  const config = { app: { security: { csp, capabilities: ['main'] } }, bundle: { createUpdaterArtifacts: signed }, plugins: {} };
  if (signed) {
    if (!env.DESKTOP_UPDATER_PUBLIC_KEY || !env.TAURI_SIGNING_PRIVATE_KEY) throw new Error('Signed updates require an updater public key and private signing key.');
    const endpoint = new URL(env.DESKTOP_UPDATER_ENDPOINT || '');
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) throw new Error('Updater endpoint must use HTTPS without credentials.');
    config.app.security.capabilities.push('signed-updates');
    config.plugins.updater = { pubkey: env.DESKTOP_UPDATER_PUBLIC_KEY, endpoints: [endpoint.href] };
    if (!/^[A-Fa-f0-9]{40}$/.test(env.WINDOWS_CERTIFICATE_THUMBPRINT || '')) throw new Error('Signed Windows releases require an imported code-signing certificate.');
    config.bundle.windows = { certificateThumbprint: env.WINDOWS_CERTIFICATE_THUMBPRINT, digestAlgorithm: 'sha256', timestampUrl: 'http://timestamp.digicert.com' };
  }
  return { api, signed, config };
}
