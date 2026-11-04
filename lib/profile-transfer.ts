import { DEFAULT_PROFILE, type UserProfile, type WatchStatus } from './types';
import { validDramaSlug, validEpisodeId } from './request-validation';

export const MAX_PROFILE_BYTES = 1_000_000;
const statuses = new Set<WatchStatus>(['watching', 'paused', 'plan-to-watch', 'finished', 'dropped']);
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid library format.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid library text.');
  return value;
}
function slug(value: unknown) {
  const result = text(value, 220);
  if (!validDramaSlug(result) || ['constructor', 'prototype', '__proto__'].includes(result)) throw new Error('Invalid drama identifier.');
  return result;
}
function integer(value: unknown, max = 100_000) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) throw new Error('Invalid library progress.');
  return value;
}
function date(value: unknown) {
  const result = text(value, 40);
  if (!Number.isFinite(Date.parse(result))) throw new Error('Invalid library date.');
  return new Date(result).toISOString();
}
function image(value: unknown) {
  if (value == null || value === '') return undefined;
  if (value === '/file.svg') return value;
  const result = text(value, 2048); const url = new URL(result);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || url.hostname.endsWith('.local') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) throw new Error('Invalid library artwork.');
  return url.href;
}
function rating(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 10) throw new Error('Invalid library rating.');
  return value;
}
function list(value: unknown) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Invalid library list size.');
  return value.map(record);
}

/** Construct known fields only; never merge an imported object into application state. */
export function validateProfile(value: unknown): UserProfile {
  const source = record(value);
  const watchedEpisodes: Record<string, string[]> = Object.create(null);
  if (source.watchedEpisodes !== undefined) {
    const history = record(source.watchedEpisodes);
    if (Object.keys(history).length > 1000) throw new Error('Library history is too large.');
    for (const [key, values] of Object.entries(history)) {
      if (!Array.isArray(values) || values.length > 5000 || values.some(value => typeof value !== 'string' || !validEpisodeId(value))) throw new Error('Invalid episode history.');
      watchedEpisodes[slug(key)] = [...new Set(values as string[])];
    }
  }
  return {
    ...DEFAULT_PROFILE,
    createdAt: source.createdAt ? date(source.createdAt) : new Date().toISOString(),
    updatedAt: source.updatedAt ? date(source.updatedAt) : new Date().toISOString(),
    profilePicture: /^avatar-[1-6]$/.test(String(source.profilePicture)) ? String(source.profilePicture) : 'avatar-1',
    watchedEpisodes,
    watchlist: list(source.watchlist || []).map(item => {
      if (!statuses.has(item.status as WatchStatus)) throw new Error('Invalid watchlist status.');
      const progress = item.progress ? record(item.progress) : undefined;
      return { slug: slug(item.slug), title: text(item.title, 300), image: image(item.image), status: item.status as WatchStatus, dateAdded: date(item.dateAdded), rating: rating(item.rating), progress: progress ? { currentEpisode: integer(progress.currentEpisode), totalEpisodes: progress.totalEpisodes === undefined ? undefined : integer(progress.totalEpisodes), lastWatched: date(progress.lastWatched) } : undefined };
    }),
    continueWatching: list(source.continueWatching || []).map(item => {
      if (item.episodeRoute !== undefined && (typeof item.episodeRoute !== 'string' || !validEpisodeId(item.episodeRoute))) throw new Error('Invalid episode route.');
      return { slug: slug(item.slug), title: text(item.title, 300), image: image(item.image), currentEpisode: integer(item.currentEpisode), episodeRoute: item.episodeRoute as string | undefined, totalEpisodes: item.totalEpisodes === undefined ? undefined : integer(item.totalEpisodes), lastWatched: date(item.lastWatched), dateAdded: date(item.dateAdded) };
    }),
    topRankings: list(source.topRankings || []).map(item => ({ slug: slug(item.slug), title: text(item.title, 300), image: image(item.image), rank: integer(item.rank, 10), rating: rating(item.rating) || 1, isPublic: item.isPublic === true })),
  };
}

export function exportProfile(profile: UserProfile) {
  const content = JSON.stringify({ format: 'hanstream-library', version: 1, exportedAt: new Date().toISOString(), profile: validateProfile(profile) }, null, 2);
  if (new TextEncoder().encode(content).byteLength > MAX_PROFILE_BYTES) throw new Error('Library export exceeds 1 MB.');
  return content;
}
export function importProfile(content: string) {
  if (new TextEncoder().encode(content).byteLength > MAX_PROFILE_BYTES) throw new Error('Library files must be smaller than 1 MB.');
  const envelope = record(JSON.parse(content));
  if (envelope.format !== 'hanstream-library' || envelope.version !== 1 || !envelope.profile) throw new Error('Unsupported library file.');
  return validateProfile(envelope.profile);
}
