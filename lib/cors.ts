/** Cross-origin reads are limited to the deployed frontend's exact origins. */
export function allowedFrontend(origin: string, configured = process.env.FRONTEND_ORIGINS || "") {
  return configured.split(",").map(value => value.trim()).some(value => {
    try { const url = new URL(value); return url.origin === value && value === origin && ["http:", "https:"].includes(url.protocol); }
    catch { return false; }
  });
}
