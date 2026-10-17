import Link from "next/link";
import Image from "next/image";
import type { TopDramasResponse } from "@/lib/api-types";

export function TopAiringSection({ result }: { result: TopDramasResponse["result"] }) {
  const sections = [{ key: "airing", title: "Airing Shows" }, { key: "upcoming", title: "Upcoming Shows" }, { key: "popular", title: "Most Popular Shows" }] as const;
  return <aside aria-label="Drama rankings" className="space-y-5">
    {sections.map(section => <section key={section.key} className="glass-card rounded-2xl p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-2"><h2 className="font-semibold text-primary text-sm">{section.title}</h2>{section.key === "popular" && <Link href="/popular" className="text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">View all</Link>}</div>
      {result.errors[section.key] ? <p className="text-xs text-secondary py-3">{result.errors[section.key]}</p> : result.lists[section.key].length ? <ol className="space-y-2">{result.lists[section.key].slice(0, 5).map(item => <li key={item.slug}>
        <Link href={item.detail_link} className="top-airing-item flex items-center gap-3 p-2 rounded-lg group">
          <span className={`top-airing-rank ${item.rank <= 3 ? "top-3" : ""} w-5 shrink-0 text-center text-sm`}>{item.rank}</span>
          <div className="relative w-10 h-14 shrink-0 rounded-lg overflow-hidden surface"><Image src={item.image} alt={item.title} fill sizes="40px" className="object-cover" /></div>
          <div className="min-w-0"><h3 className="text-sm font-medium text-primary line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">{item.title}</h3>{item.release_year > 0 && <p className="text-xs text-secondary mt-1">{item.release_year}</p>}</div>
        </Link>
      </li>)}</ol> : <p className="text-xs text-secondary">No rankings are listed right now.</p>}
      <p className="text-[11px] text-secondary">{section.key === "airing" ? "Alphabetical" : section.key === "upcoming" ? "Soonest premieres" : "Most viewed"}</p>
    </section>)}
  </aside>;
}
