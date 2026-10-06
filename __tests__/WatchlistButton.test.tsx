import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { WatchlistButton } from "../components/WatchlistButton";

// Mock Profile hook with mutable state per test
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockUpdateWatchlistStatus = vi.fn();
let currentProfile: any = { watchlist: [], ratings: {} };

vi.mock("@/lib/profile", () => ({
  useProfile: () => ({
    profile: currentProfile,
    addToWatchlist: mockAddToWatchlist,
    removeFromWatchlist: mockRemoveFromWatchlist,
    updateWatchlistStatus: mockUpdateWatchlistStatus,
    rateItem: vi.fn(),
  }),
}));

describe("WatchlistButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentProfile = { watchlist: [], ratings: {} };
  });

  it("should render watchlist button", () => {
    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it('should show "Add to Watchlist" when not in watchlist', async () => {
    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    await waitFor(() => {
      expect(screen.getByText(/add to watchlist/i)).toBeInTheDocument();
    });
  });

  it("should show status dropdown and allow removal when selecting same status", async () => {
    currentProfile = {
      watchlist: [{ slug: "test-drama", status: "watching" }],
      ratings: {},
    };

    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    // Open menu
    fireEvent.click(screen.getByRole("button"));
    // Wait until dropdown renders items (there will be two 'Watching' entries)
    await waitFor(() => {
      expect(screen.getAllByText("Watching").length).toBeGreaterThan(1);
    });
    const statusBtn = screen.getAllByText("Watching")[1];
    fireEvent.click(statusBtn);

    await waitFor(() => {
      expect(mockRemoveFromWatchlist).toHaveBeenCalledWith("test-drama");
    });
  });

  it("should add drama to watchlist when selecting a status", async () => {
    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    // Open menu
    fireEvent.click(screen.getByRole("button"));
    // Choose a status, e.g., Watching (disambiguate duplicates)
    const allWatching = await screen.findAllByText("Watching");
    const statusBtn =
      allWatching.find((el) => el.className.includes("font-medium")) ||
      allWatching[0];
    fireEvent.click(statusBtn);

    await waitFor(() => {
      expect(mockAddToWatchlist).toHaveBeenCalledWith({
        slug: "test-drama",
        title: "Test Drama",
        image: "test.jpg",
        status: "watching",
      });
    });
  });

  it("should update status when selecting a different status", async () => {
    currentProfile = {
      watchlist: [{ slug: "test-drama", status: "paused" }],
      ratings: {},
    };

    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    fireEvent.click(screen.getByRole("button"));
    const allWatching = await screen.findAllByText("Watching");
    const statusBtn =
      allWatching.find((el) => el.className.includes("font-medium")) ||
      allWatching[0];
    fireEvent.click(statusBtn);

    await waitFor(() => {
      expect(mockUpdateWatchlistStatus).toHaveBeenCalledWith(
        "test-drama",
        "watching"
      );
    });
  });

  it("should wait for a local profile to load", () => {
    currentProfile = null;

    const { container } = render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    expect(container.firstChild).toBeNull();
  });
});
