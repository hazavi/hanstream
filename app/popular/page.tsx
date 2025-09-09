import { fetchPopular, PopularItem } from "../../lib/api";
import { DramaCard } from "../../components/DramaCard";
import { Pagination } from "../../components/Pagination";

export const revalidate = 300; // 5 minutes

interface PopularResponse {
  results: PopularItem[];
}

export default async function PopularPage({
  searchParams,
}: {
  searchParams: { page?: string } | Promise<{ page?: string }>;
}) {
  let params: { page?: string };
  if (
    typeof searchParams === "object" &&
    searchParams !== null &&
    "then" in searchParams
  ) {
    params = await searchParams;
  } else {
    params = searchParams as { page?: string };
  }
  const page = Number(params?.page || "1");
  const data: PopularResponse = await fetchPopular(page);
  const hasResults = Array.isArray(data.results) && data.results.length > 0;
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold heading">
          Popular Dramas
        </h1>
      </div>

      <Pagination page={page} basePath="/popular" />

      {hasResults ? (
        <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {data.results.map((d) => (
            <DramaCard key={d["detail-link"]} item={d} variant="popular" />
          ))}
        </div>
      ) : (
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
          <p className="text-sm text-secondary">No popular dramas found.</p>
        </div>
      )}

      <Pagination page={page} basePath="/popular" />
    </div>
  );
}
