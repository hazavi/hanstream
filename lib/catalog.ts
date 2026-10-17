export type CatalogTitle = {
  title: string; image: string; url: string; year?: number; movie?: boolean;
  note?: string; date?: string; reviewer?: string; rating?: string; reviewUrl?: string;
};

export function normalizeTitle(title: string): string {
  return title.normalize("NFKC").toLowerCase().replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Title and year travel together across the three independent catalogs.
export function catalogRoute(item: Pick<CatalogTitle, "title" | "year" | "movie">): string {
  return `/${item.movie ? "film" : "drama"}-${normalizeTitle(item.title).replace(/ /g, "-")}${item.year ? `--${item.year}` : ""}`;
}

export function parseCatalogRoute(slug: string): { title: string; year?: number; movie: boolean } | null {
  const match = /^(drama|film)-(.+?)(?:--(\d{4}))?$/.exec(slug);
  return match ? { title: match[2].replace(/-/g, " "), year: match[3] ? Number(match[3]) : undefined, movie: match[1] === "film" } : null;
}
