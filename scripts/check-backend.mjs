/** Check the public connection without receiving or exposing source configuration. */
export async function checkBackend(base, origin, request = fetch) {
  const read = async (route, timeout) => {
    let response;
    try {
      response = await request(`${base}${route}`, { headers: { Origin: origin }, credentials: 'omit', signal: AbortSignal.timeout(timeout) });
    } catch {
      throw new Error('The backend did not respond. Check its Render deployment and allow time for it to wake up.');
    }
    if (!response.ok) throw new Error(`Backend check failed (HTTP ${response.status}). Check its private environment settings and deployment logs.`);
    if (response.headers.get('access-control-allow-origin') !== origin) throw new Error('The backend does not allow this frontend origin. Add it to FRONTEND_ORIGINS on Render.');
    try { return await response.json(); }
    catch { throw new Error('The backend did not return valid app data.'); }
  };
  const health = await read('/api/health', 120_000);
  if (health.status !== 'ok') throw new Error('The backend is not ready.');
  const home = await read('/api/home', 180_000);
  if (!Array.isArray(home.recent) || !home.recent.length || !['reviews', 'trending', 'starting', 'ending'].every(key => Array.isArray(home.home?.[key]))) throw new Error('The backend has not loaded the homepage catalog. Check its source settings before connecting Pages.');
  return { recent: home.recent.length };
}
