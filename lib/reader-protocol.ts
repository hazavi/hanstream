import {
  validDramaSlug,
  validEpisodeId,
  validSearchQuery,
} from "./request-validation";
import { detailNeedsRefresh } from "./detail-cache";
import type { DramaResponse } from "./api-types";
export type ReaderJob =
  | { kind: "home" | "rankings" | "hot" }
  | { kind: "recent" | "popular" | "movies"; page: number }
  | { kind: 'browse'; category: 'popular' | 'popular-new' | 'ongoing' | 'ongoing-kshows'; page: number }
  | { kind: "search"; query: string; page: number; preview?: boolean }
  | { kind: "drama"; slug: string }
  | { kind: "episode"; slug: string; episode: string }
  | {
      kind: "artwork";
      title: string;
      year?: number;
      movie?: boolean;
      secondary: boolean;
      width: number;
    }
  | { kind: "portrait"; name: string; key?: string; width: number };
export type ReaderImage = {
  status: number;
  body: string;
  headers: Record<string, string>;
};
export function parseReaderJob(input: unknown): ReaderJob {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid reader request.");
  const value = input as Record<string, unknown>;
  const kind = value.kind;
  const page = () => {
    if (
      typeof value.page !== "number" ||
      !Number.isInteger(value.page) ||
      value.page < 1 ||
      value.page > 2000
    )
      throw new Error("Enter a valid page from 1 to 2000.");
    return value.page;
  };
  const slug = () => {
    if (typeof value.slug !== "string" || !validDramaSlug(value.slug))
      throw new Error("Invalid drama.");
    return value.slug;
  };
  const width = () => {
    if (
      typeof value.width !== "number" ||
      ![80, 160, 320, 640].includes(value.width)
    )
      throw new Error("Invalid image width.");
    return value.width;
  };
  switch (kind) {
    case "home":
    case "rankings":
    case "hot":
      return { kind };
    case "recent":
    case "popular":
    case "movies":
      return { kind, page: page() };
    case "search":
      if (
        typeof value.query !== "string" ||
        !value.query.trim() ||
        !validSearchQuery(value.query)
      )
        throw new Error("Search must contain 1 to 160 characters.");
      if (value.preview !== undefined && typeof value.preview !== 'boolean') throw new Error('Invalid search mode.');
      return { kind, query: value.query.trim(), page: page(), ...(value.preview ? {preview:true} : {}) };
    case 'browse':
      if (typeof value.category !== 'string' || !['popular','popular-new','ongoing','ongoing-kshows'].includes(value.category)) throw new Error('Invalid drama category.');
      return {kind, category: value.category as 'popular' | 'popular-new' | 'ongoing' | 'ongoing-kshows', page: page()};
    case "drama":
      return { kind, slug: slug() };
    case "episode":
      if (typeof value.episode !== "string" || !validEpisodeId(value.episode))
        throw new Error("Invalid episode.");
      return { kind, slug: slug(), episode: value.episode };
    case "artwork": {
      if(value.movie!==undefined&&typeof value.movie!=='boolean')throw new Error('Invalid artwork type.');
      if (
        typeof value.title !== "string" ||
        !value.title.trim() ||
        !validSearchQuery(value.title) ||
        typeof value.secondary !== "boolean"
      )
        throw new Error("Invalid artwork.");
      if (
        value.year !== undefined &&
        (typeof value.year !== "number" ||
          !Number.isInteger(value.year) ||
          value.year < 1900 ||
          value.year > 2100)
      )
        throw new Error("Invalid year.");
      return {
        kind,
        title: value.title.trim(),
        ...(value.year ? { year: value.year as number } : {}),
        ...(value.movie?{movie:true}:{}),
        secondary: value.secondary,
        width: width(),
      };
    }
    case "portrait":
      if (
        typeof value.name !== "string" ||
        value.name.length > 120 ||
        !/[\p{L}]/u.test(value.name) ||
        /[<>/\\]/.test(value.name)
      )
        throw new Error("Invalid portrait.");
      if (
        value.key !== undefined &&
        (typeof value.key !== "string" ||
          value.key.length > 200 ||
          !/^(?:article|profile):[\p{L}\p{N}_().,'’ -]+$/u.test(value.key))
      )
        throw new Error("Invalid portrait key.");
      return {
        kind,
        name: value.name.trim(),
        ...(value.key ? { key: value.key as string } : {}),
        width: width(),
      };
    default:
      throw new Error("Unsupported reader request.");
  }
}
export function readerTiming(job: ReaderJob, value?: unknown) {
  if (value !== undefined) {
    const data = value as {
      result?: { video?: string };
      partial?: boolean;
      headers?: Record<string, string>;
    };
    if (job.kind === "episode" && !data?.result?.video)
      return { fresh: 2000, retain: 2 };
    if (
      job.kind === "drama" &&
      detailNeedsRefresh((value || {}) as DramaResponse)
    )
      return { fresh: 15_000, retain: 86_400 };
    if (job.kind === "home" && data?.partial)
      return { fresh: 10_000, retain: 86_400 };
    if (
      (job.kind === "artwork" || job.kind === "portrait") &&
      data?.headers?.["x-artwork-available"] === "0"
    )
      return job.kind==='artwork'?{fresh:5000,retain:15}:{fresh:30_000,retain:60};
  }
  if (job.kind === "episode") return { fresh: 20_000, retain: 60 };
  if (job.kind === "search") return { fresh: 60_000, retain: 300 };
  if (job.kind === "artwork" || job.kind === "portrait")
    return { fresh: 3_600_000, retain: 86_400 };
  if (job.kind === "drama") return { fresh: 300_000, retain: 86_400 };
  return { fresh: 30_000, retain: 86_400 };
}
