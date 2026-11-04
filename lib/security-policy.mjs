/** Shared policy for the backend and the static Pages export. No private settings. */
export function contentSecurityPolicy({ development = false, apiOrigin = '', scriptHashes, meta = false, nonce = '' } = {}) {
  const connect = ["'self'"];
  if (apiOrigin) {
    const url = new URL(apiOrigin);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== apiOrigin) throw new Error('Invalid public API origin');
    connect.push(url.origin);
  }
  if (development) connect.push('ws:', 'wss:');
  if (nonce && !/^[a-zA-Z0-9+/=_-]{20,128}$/.test(nonce)) throw new Error('Invalid script nonce');
  const scripts = ["'self'", ...(scriptHashes || []), ...(nonce ? [`'nonce-${nonce}'`] : [])];
  if (development) scripts.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    'frame-src https:',
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    ...(!meta ? ["frame-ancestors 'none'"] : []),
  ].join('; ');
}

export function securityHeaders(development = false) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy({ development }) },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    ...(!development ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
  ];
}
