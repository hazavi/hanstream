/** Reject executable URLs, credentials, literal IPs and local hostnames in media frames. */
export function safeEmbedUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /\.(?:localhost|local|internal)$/.test(host)) return;
    if (typeof window !== 'undefined' && url.origin === window.location.origin) return;
    return url.href;
  } catch { return; }
}

// Keep video scripts and origin storage, but deny popups, downloads and top navigation.
export const MEDIA_SANDBOX = 'allow-scripts allow-same-origin allow-presentation';
export const MEDIA_PERMISSIONS = "autoplay; fullscreen; encrypted-media; picture-in-picture; camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'";
