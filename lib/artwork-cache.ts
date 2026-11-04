/** Remember working image candidates, not image bytes or private source settings. */
const winners = new Map<string, {url:string;expires:number}>();
const failures = new Map<string, number>();
const retries = new Map<string, number>();
const listeners = new Map<string, Set<()=>void>>();
function bound<T>(map: Map<string,T>, capacity = 250) { if (map.size > capacity) map.delete(map.keys().next().value!); }

export function artworkFailedRecently(url: string) { return (failures.get(url) || 0) > Date.now(); }
export function artworkWinner(key: string) {
  const saved = winners.get(key);
  return saved && saved.expires > Date.now() && !artworkFailedRecently(saved.url) ? saved.url : undefined;
}
export function rememberArtwork(key: string, url: string) {
  failures.delete(url);
  if (artworkWinner(key) === url) return;
  winners.set(key, {url,expires:Date.now()+1_800_000});
  bound(winners);
  listeners.get(key)?.forEach(listener=>listener());
}
export function failArtwork(key: string, url: string) {
  failures.set(url,Date.now()+5000); bound(failures);
  if (winners.get(key)?.url===url) winners.delete(key);
}
export function subscribeArtwork(key: string, listener:()=>void) {
  const group = listeners.get(key) || new Set();
  group.add(listener); listeners.set(key,group);
  return () => { group.delete(listener); if(!group.size)listeners.delete(key); };
}
export function claimArtworkRetry(key: string) {
  if ((retries.get(key)||0)>Date.now()) return false;
  retries.set(key,Date.now()+60_000); bound(retries); return true;
}
export function clearArtworkCache() { winners.clear(); failures.clear(); retries.clear(); }
