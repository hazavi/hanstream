import { fetchRecent } from '../../lib/api';
import { DramaCard } from '../../components/DramaCard';
import { Pagination } from '../../components/Pagination';

export const revalidate = 60; // ISR

export default async function RecentlyAddedPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams?.page || '1');
  const data = await fetchRecent(page);
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold heading">Recently Added Episodes</h1>
      </div>
      
      <Pagination page={page} basePath="/recently-added" />
      
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {data.results.map((d:any) => (
          <DramaCard key={d['episode-link']} item={d} variant="recent" />
        ))}
      </div>
      
      <Pagination page={page} basePath="/recently-added" />
    </div>
  );
}
