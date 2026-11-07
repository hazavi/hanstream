import type { EpisodeResponse } from "./api-types";
import { safeEmbedUrl } from './embed';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown) => value === undefined || typeof value === 'string';

/** A queued/error envelope must never become a player result. */
export function isPlaybackResponse(value: unknown): value is EpisodeResponse {
  if (!object(value) || !object(value.result)) return false;
  const result = value.result;
  return typeof result.video === 'string'
    && (!result.video || Boolean(safeEmbedUrl(result.video)))
    && text(result.title) && text(result.current_episode)
    && (result.category === undefined || object(result.category) && text(result.category.title))
    && (result.servers === undefined || Array.isArray(result.servers) && result.servers.length <= 50 && result.servers.every(server => object(server) && text(server.name) && typeof server.url === 'string' && Boolean(safeEmbedUrl(server.url))))
    && (result.episodes === undefined || Array.isArray(result.episodes) && result.episodes.length <= 10_000 && result.episodes.every(episode => object(episode) && ['id', 'title', 'time', 'image', 'description'].every(key => text(episode[key])) && ['season', 'episode'].every(key => episode[key] === undefined || typeof episode[key] === 'number' && Number.isFinite(episode[key]))));
}
