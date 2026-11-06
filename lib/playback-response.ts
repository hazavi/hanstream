import type { EpisodeResponse } from "./api-types";

/** A queued/error envelope must never become a player result. */
export function isPlaybackResponse(value: unknown): value is EpisodeResponse {
  if (!value || typeof value !== "object") return false;
  const result = (value as { result?: unknown }).result;
  return Boolean(
    result &&
      typeof result === "object" &&
      typeof (result as { video?: unknown }).video === "string",
  );
}
