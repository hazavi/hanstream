import { fetchSearchCached, SearchResultItem } from "../../lib/api";
import { DramaCard } from "@/components/DramaCard";
import { redirect } from "next/navigation";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const page = params.page ? parseInt(params.page, 10) || 1 : 1;

  let data: { results?: SearchResultItem[] } | null = null;
  let results: SearchResultItem[] = [];
  let error: string | null = null;

  // Enforce presence of a query; redirect if missing
  if (!query) {
    redirect("/");
  }

  try {
    data = await fetchSearchCached(query, page);
    results = data && data.results ? data.results : [];
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch search results";
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold heading">
        Search results for{" "}
        <span className="text-accent">
          &quot;{query.replace(/-/g, " ")}&quot;
        </span>
      </h1>

      {error && (
        <div className="glass-card p-8 text-center text-red-500 text-sm">
          {error}
        </div>
      )}

      {!error && results.length === 0 && (
        <div className="glass-card p-10 text-center space-y-4 animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold heading">No results</h2>
          <p className="text-sm text-secondary">Nothing matched that title.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {results.map((r) => (
            <DramaCard key={r["detail-link"]} item={r} variant="popular" />
          ))}
        </div>
      )}
    </div>
  );
}
