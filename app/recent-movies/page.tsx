import { fetchRecentMovies, RecentMovieItem } from "../../lib/api";
import { DramaCard } from "../../components/DramaCard";
import { Pagination } from "../../components/Pagination";

export const revalidate = 60; // ISR

export default async function RecentMoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params?.page || "1");

  try {
    const data = await fetchRecentMovies(page);

    // Debug: Log the actual response structure
    console.log("Recent movies API response:", JSON.stringify(data, null, 2));

    // Check if data has the expected structure
    if (
      !data ||
      !data.result ||
      !data.result.movies ||
      !Array.isArray(data.result.movies)
    ) {
      console.log("Invalid data structure:", data);
      return (
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold heading">
              Recent Movies
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              No movies available at the moment.
            </p>
          </div>
        </div>
      );
    }

    // Transform the movie data to match DramaCard expectations
    const transformedMovies = data.result.movies.map(
      (movie: RecentMovieItem) => ({
        "detail-link": movie.id.replace("/episode/1", ""), // Remove episode part to get drama link
        "episode-link": movie.id,
        // Don't pass episode_number for movies - this will show "Movie" instead
        image: movie.img,
        time: movie.time,
        title: movie.title,
        type: movie.type,
      })
    );

    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold heading">
            Recent Movies
          </h1>
        </div>

        <Pagination page={page} basePath="/recent-movies" />

        <div className="grid gap-3 grid-cols-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {transformedMovies.map((movie) => (
            <DramaCard
              key={movie["episode-link"]}
              item={movie}
              variant="recent"
            />
          ))}
        </div>

        <Pagination page={page} basePath="/recent-movies" />
      </div>
    );
  } catch (error) {
    console.error("Error fetching recent movies:", error);
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold heading">
            Recent Movies
          </h1>
          <p className="text-red-600 dark:text-red-400">
            Failed to load recent movies. Please try again later.
          </p>
        </div>
      </div>
    );
  }
}
