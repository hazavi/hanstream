import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PagesApp from "../components/PagesApp";
import { readBackend } from "../lib/pages-client";

const location = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.query) }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props}>{children}</a> }));
vi.mock("next/image", () => ({ default: ({ fill: _fill, ...props }: React.ComponentProps<"img"> & { fill?: boolean }) => <img {...props} /> }));
vi.mock("../lib/pages-client", () => ({ readBackend: vi.fn() }));
vi.mock("../components/ContinueWatching", () => ({ ContinueWatching: () => null }));
vi.mock("../components/WatchlistButton", () => ({ WatchlistButton: () => null }));
vi.mock("../components/DramaRatingButton", () => ({ DramaRatingButton: () => null }));
vi.mock("../components/EpisodeProgressTracker", () => ({ EpisodeProgressTracker: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); location.query = ""; });

it("loads all homepage sections and the sidebar without homepage tabs", async () => {
  vi.mocked(readBackend).mockResolvedValue({ home: { reviews: [], trending: [], starting: [], ending: [] }, recent: [], popular: [], hero: [], rankings: { lists: { airing: [], upcoming: [], popular: [] }, errors: {} } });
  render(<PagesApp view="home" />);
  expect(await screen.findByRole("heading", { name: "Latest Reviews" })).toBeInTheDocument();
  for (const name of ["Trending This Week", "Shows Starting This Week", "Shows Ending This Week", "Airing Shows", "Upcoming Shows", "Most Popular Shows"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(readBackend).toHaveBeenCalledWith("/api/home", expect.any(AbortSignal));
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
