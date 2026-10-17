/** Only public frontend connection settings belong in this build configuration.
 * @param {Record<string, string | undefined>} [env]
 */
export function getPagesConfig(env = process.env) {
  let api = (env.NEXT_PUBLIC_API_BASE_URL || '').trim();
  if (api) {
    try {
      const url = new URL(api);
      const localPreview = !env.GITHUB_ACTIONS && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !(url.protocol === 'https:' || localPreview)) throw new Error();
      api = url.origin;
    } catch {
      throw new Error('The backend URL must be an HTTPS origin (localhost HTTP is allowed for local preview).');
    }
  }
  const basePath = (env.PAGES_BASE_PATH || '').trim().replace(/\/$/, '');
  if (basePath && !/^\/[a-zA-Z0-9._-]+$/.test(basePath)) throw new Error('PAGES_BASE_PATH must be empty or one repository path, such as /hanstream.');
  return { api, basePath };
}
