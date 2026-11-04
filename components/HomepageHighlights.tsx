import Link from "next/link";
import { Artwork } from "./Artwork";
import { catalogRoute, type CatalogTitle } from "@/lib/catalog";

const sections = [
  { key: "reviews", title: "Latest Reviews" },
  { key: "trending", title: "Trending This Week" },
  { key: "starting", title: "Shows Starting This Week" },
  { key: "ending", title: "Shows Ending This Week" },
] as const;

export type HomepageHighlightsData = Record<(typeof sections)[number]["key"], CatalogTitle[]>;

function reviewDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "Europe/Copenhagen",
  });
}

export function HomepageHighlights({ home }: { home: HomepageHighlightsData }) {
  return <aside aria-label="Homepage highlights" className="space-y-5">
    {sections.map(section => <section key={section.key} id={section.key} className="glass-card rounded-2xl p-4 space-y-4">
      <h2 className="font-semibold text-primary text-sm">{section.title}</h2>
      {home[section.key].length ? <ol className="space-y-2">
        {home[section.key].slice(0, 5).map((item, index) => {
          const date = section.key === "reviews" ? reviewDate(item.date) : undefined;
          return <li key={`${catalogRoute(item)}-${item.date || index}`}>
            <Link href={catalogRoute(item)} className="top-airing-item flex items-center gap-3 p-2 rounded-lg group">
              <span aria-hidden="true" className="w-5 shrink-0 text-center text-sm font-semibold text-secondary tabular-nums">{index + 1}</span>
              <div className="relative w-10 h-14 shrink-0 rounded-md overflow-hidden surface">
                <Artwork sources={[item.image]} alt={item.title} title={item.title} year={item.year} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-primary line-clamp-2 group-hover:text-neutral-600 dark:group-hover:text-neutral-400">{item.title}</h3>
                {item.note && <p className="text-xs text-secondary line-clamp-2 mt-1">{item.note}</p>}
                {date ? <time className="block text-xs text-secondary mt-1" dateTime={item.date}>{date}</time> : item.year ? <p className="text-xs text-secondary mt-1">{item.year}</p> : null}
              </div>
            </Link>
          </li>;
        })}
      </ol> : <p className="text-xs text-secondary">{section.key === "reviews" ? "No reviews are listed right now." : "No shows are listed right now."}</p>}
    </section>)}
  </aside>;
}
