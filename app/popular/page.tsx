import { fetchPopular, PopularItem } from '../../lib/api';
import { DramaCard } from '../../components/DramaCard';
import { Pagination } from '../../components/Pagination';

export const revalidate = 300; // 5 minutes

interface PopularResponse { results: PopularItem[] }

export default async function PopularPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams?.page || '1');
  const data: PopularResponse = await fetchPopular(page);
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold heading">Popular Dramas</h1>
      </div>
      
      <Pagination page={page} basePath="/popular" />
      
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
  {data.results.map((d) => (
          <DramaCard key={d['detail-link']} item={d} variant="popular" />
        ))}
      </div>
      
      <Pagination page={page} basePath="/popular" />
    </div>
  );
}
