import type { DramaResponse } from './api-types';
import { isPublishedImage } from './image-utils.mjs';

export function detailNeedsRefresh(response: DramaResponse) {
  const detail = response.result;
  return !detail?.description || Boolean(detail.detailsUnavailable || detail.refreshPending) || !isPublishedImage(detail.image) || Number(detail.meta?.Episodes) > 0 && !detail.episodes?.length;
}

/** A temporary source outage must not replace known details with empty fields. */
export function mergeDramaResponse(previous: DramaResponse | undefined, current: DramaResponse): DramaResponse {
  const old = previous?.result;
  const next = current.result;
  if (!old) return current;
  if (!next) return previous!;
  const publishedMeta = Object.fromEntries(Object.entries(next.meta || {}).filter(([, value]) => value != null && value !== ''));
  const knownEpisodes = new Map(old.episodes?.map(episode=>[`${episode.season||1}/${episode.episode}`,episode]));
  const episodes = next.episodes?.length ? next.episodes.map(episode=>{
    const known=knownEpisodes.get(`${episode.season||1}/${episode.episode}`);
    return {...known,...episode,title:episode.title||known?.title,description:episode.description||known?.description,image:isPublishedImage(episode.image)?episode.image:known?.image,release_date:episode.release_date||known?.release_date};
  }) : old.episodes;
  const knownCast = new Map(old.cast?.map(person=>[person.name.normalize('NFKC').toLowerCase(),person]));
  const cast = next.cast?.length ? next.cast.map(person=>{
    const known=knownCast.get(person.name.normalize('NFKC').toLowerCase());
    return {...known,...person,character:person.character||known?.character,image:isPublishedImage(person.image)?person.image:known?.image,portraitKey:person.portraitKey||known?.portraitKey};
  }) : old.cast;
  return { ...current, result: {
    ...old, ...next,
    title: next.title || old.title,
    description: next.description || old.description,
    other_names: next.other_names || old.other_names,
    image: isPublishedImage(next.image) ? next.image : old.image,
    meta: { ...old.meta, ...publishedMeta },
    episodes,
    cast,
    tags: next.tags?.length ? next.tags : old.tags,
    genres: next.genres?.length ? next.genres : old.genres,
    poster_fallbacks: next.poster_fallbacks?.length ? next.poster_fallbacks : old.poster_fallbacks,
    trailer: next.trailer || old.trailer,
    detailsUnavailable: Boolean(next.detailsUnavailable && old.detailsUnavailable),
  } };
}
