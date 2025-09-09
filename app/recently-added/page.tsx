import { fetchRecent, RecentItem } from "../../lib/api";
import { DramaCard } from "../../components/DramaCard";
import { Pagination } from "../../components/Pagination";

export const revalidate = 60; // ISR

interface RecentResponse {
  results: RecentItem[];
}

export default async function RecentlyAddedPage({
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
  const data: RecentResponse = await fetchRecent(page);
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold heading">
          Recently Added Episodes
        </h1>
      </div>

      <Pagination page={page} basePath="/recently-added" />

      <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {data.results.map((d) => (
          <DramaCard key={d["episode-link"]} item={d} variant="recent" />
        ))}
      </div>

      <Pagination page={page} basePath="/recently-added" />
    </div>
  );
}
