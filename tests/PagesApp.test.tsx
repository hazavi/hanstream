import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PagesApp from "../components/PagesApp";
import { readBackend } from "../lib/pages-client";

const location = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.query) }));
vi.mock("next/link", () => ({ default: ({ children, href, prefetch: _prefetch, ...props }: React.ComponentProps<"a"> & { prefetch?: boolean }) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, ...props }: React.ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => <img {...props} /> }));
vi.mock("../lib/pages-client", () => ({ readBackend: vi.fn(), peekBackend: vi.fn() }));
vi.mock("../components/ContinueWatching", () => ({ ContinueWatching: () => null }));
vi.mock("../components/WatchlistButton", () => ({ WatchlistButton: () => null }));
vi.mock("../components/DramaRatingButton", () => ({ DramaRatingButton: () => null }));
vi.mock("../components/EpisodeProgressTracker", () => ({ EpisodeProgressTracker: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); location.query = ""; });

it('recovers richer details once without replacing visible content with a loading screen', async () => {
  vi.useFakeTimers();location.query='id=drama-recovery--2026';
  vi.mocked(readBackend).mockResolvedValueOnce({result:{title:'Recovery',description:'Initial summary',image:'https://pictures.example/poster.jpg',refreshPending:true}}).mockResolvedValueOnce({result:{title:'Recovery',description:'Complete summary',image:'https://pictures.example/poster.jpg'}});
  render(<PagesApp view="drama"/>);
  await act(async()=>{});
  expect(screen.getByText('Initial summary')).toBeInTheDocument();
  await act(()=>vi.advanceTimersByTimeAsync(16000));
  expect(screen.getByText('Complete summary')).toBeInTheDocument();
  expect(readBackend).toHaveBeenLastCalledWith('/api/drama/drama-recovery--2026',expect.any(AbortSignal),{fresh:true,sameOrigin:true});
  expect(readBackend).toHaveBeenCalledTimes(2);
});

it("loads all homepage sections and the sidebar without homepage tabs", async () => {
  vi.mocked(readBackend).mockResolvedValue({ home: { reviews: [], trending: [], starting: [], ending: [] }, recent: [], popular: [], hero: [{ full_title: "Previously featured" }], rankings: { lists: { airing: [], upcoming: [], popular: [] }, errors: {} } });
  render(<PagesApp view="home" />);
  expect(await screen.findByRole("heading", { name: "Latest Reviews" })).toBeInTheDocument();
  for (const name of ["Trending This Week", "Shows Starting This Week", "Shows Ending This Week", "Airing Shows", "Upcoming Shows", "Most Popular Shows"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByTestId("homepage-carousel")).toBeNull();
  expect(readBackend).toHaveBeenCalledWith("/api/home", expect.any(AbortSignal));
});
it("shows rich details, falls back from a broken poster, and loads the trailer on request", async () => {
  location.query = "id=drama-test--2026";
  vi.mocked(readBackend).mockResolvedValue({ result: { title: "Test Drama", other_names: "Original title", image: "https://primary.example/poster.webp", poster_fallbacks: ["https://fallback.example/poster.jpg"], description: "A complete drama summary.", genres: ["Romance"], tags: ["marriage"], cast: [{ name: "Actor One", character: "Lead", image: "https://pictures.example/cast.webp" }], meta: { Country: "Korea", "Age Rating": "TV-14" }, trailer: { embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk", thumbnail: "https://pictures.example/trailer.webp" }, episodes: [{ season: 1, episode: 1, title: "A new start", image: "https://pictures.example/episode.webp", available: true, episode_link: "/drama-test--2026/episode/s1e1" }, { season: 2, episode: 1, title: "A new season", available: false, release_date: "2099-01-01", episode_link: "/drama-test--2026/episode/s2e1" }] } });
  const { container } = render(<PagesApp view="drama" />);
  expect(await screen.findByText("A complete drama summary.")).toBeInTheDocument();
  expect(screen.getByText("marriage")).toBeInTheDocument();
  expect(screen.getByText("TV-14")).toBeInTheDocument();
  expect(screen.getByRole("region", {name:"Show info"})).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab",{name:"Cast"}));
  expect(screen.getByRole("heading", {name:"Cast"})).toBeInTheDocument();
  expect(screen.getByText("Actor One")).toBeInTheDocument();
  expect(screen.queryByRole("heading", {name:"Tags"})).toBeNull();
  expect(screen.queryByRole("heading", {name:"Season 1"})).toBeNull();
  expect(screen.getByRole("link", { name: "Episode 1: A new start" })).toHaveAttribute("href", "/drama-test--2026/episode/s1e1");
  expect(screen.getByAltText("A new start")).toHaveAttribute("src", "https://pictures.example/episode.webp");
  expect(screen.queryByRole("link", { name: /A new season/ })).toBeNull();
  expect(screen.getByText("Upcoming")).toBeInTheDocument();
  fireEvent.error(screen.getByAltText("Test Drama poster"));
  expect(screen.getByAltText("Test Drama poster")).toHaveAttribute("src", "https://fallback.example/poster.jpg");
  expect(container.querySelector("iframe")).toBeNull();
  expect(screen.queryByRole("button", { name: "Play official trailer" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "Trailer" }));
  fireEvent.click(screen.getByRole("button", { name: "Play official trailer" }));
  expect(container.querySelector("iframe")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0");
});
it("loads a directly opened detail query and displays its available episodes", async () => {
  location.query = "id=drama-test--2026";
  vi.mocked(readBackend).mockResolvedValue({ result: { title: "Test Drama", description: "A drama description.", episodes: [{ episode: 1, episode_link: "/drama-test--2026/episode/s1e1" }] } });
  render(<PagesApp view="drama" />);
  expect(await screen.findByRole("heading", { name: "Test Drama" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Episode 1" })).toHaveAttribute("href", "/drama-test--2026/episode/s1e1");
  expect(readBackend).toHaveBeenCalledWith("/api/drama/drama-test--2026", expect.any(AbortSignal));
});
it("lets a failed page load be retried", async () => {
  vi.mocked(readBackend).mockRejectedValueOnce(new Error("Service unavailable")).mockResolvedValueOnce({ items: [], page: 1, hasNext: false });
  render(<PagesApp view="popular" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Popular Dramas" })).toBeInTheDocument();
  expect(readBackend).toHaveBeenCalledTimes(2);
});
it("retries an unavailable watch episode without dropping the episode list", async () => {
  location.query = 'id=drama-test--2026&episode=s1e1';
  const result = { title: 'Test Drama - Episode 1', video: '', episodes: [{ id: 's1e1', title: 'A fresh start', description: 'The episode story.' }] };
  vi.mocked(readBackend).mockResolvedValue({ result, drama: { title: 'Test Drama' } });
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ ok:true, json:async()=>({result:{...result,video:'https://player.example/episode-one'}}) }));
  render(<PagesApp view="watch"/>);
  fireEvent.click(await screen.findByRole('button',{name:'Retry episode'}));
  expect(await screen.findByTitle('Test Drama - Episode 1')).toHaveAttribute('src','https://player.example/episode-one');
  expect(screen.getByRole('link',{name:'Episode 1: A fresh start'})).toHaveAttribute('aria-current','page');
  expect(screen.getByRole('navigation',{name:'Breadcrumb'})).toHaveTextContent('HomeTest Drama');
});
