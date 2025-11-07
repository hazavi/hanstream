import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WatchlistButton } from "../components/WatchlistButton";

// Mock Firebase auth
vi.mock("../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { uid: "test-user-123" },
    loading: false,
  })),
}));

// Mock Firebase functions
const mockAddToWatchlist = vi.fn();
const mockRemoveFromWatchlist = vi.fn();
const mockIsInWatchlist = vi.fn();

vi.mock("../lib/profile", () => ({
  addToWatchlist: (...args: any[]) => mockAddToWatchlist(...args),
  removeFromWatchlist: (...args: any[]) => mockRemoveFromWatchlist(...args),
  isInWatchlist: (...args: any[]) => mockIsInWatchlist(...args),
}));

describe("WatchlistButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render watchlist button", () => {
    mockIsInWatchlist.mockResolvedValue(false);

    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it('should show "Add to Watchlist" when not in watchlist', async () => {
    mockIsInWatchlist.mockResolvedValue(false);

    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    await waitFor(() => {
      expect(screen.getByText(/add to watchlist/i)).toBeInTheDocument();
    });
  });

  it('should show "Remove from Watchlist" when in watchlist', async () => {
    mockIsInWatchlist.mockResolvedValue(true);

    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    await waitFor(() => {
      expect(screen.getByText(/remove from watchlist/i)).toBeInTheDocument();
    });
  });

  it("should add drama to watchlist when clicked", async () => {
    mockIsInWatchlist.mockResolvedValue(false);
    mockAddToWatchlist.mockResolvedValue(undefined);

    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    await waitFor(() => {
      const button = screen.getByRole("button");
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockAddToWatchlist).toHaveBeenCalledWith("test-user-123", {
        slug: "test-drama",
        title: "Test Drama",
        image: "test.jpg",
        addedAt: expect.any(Number),
      });
    });
  });

  it("should remove drama from watchlist when clicked", async () => {
    mockIsInWatchlist.mockResolvedValue(true);
    mockRemoveFromWatchlist.mockResolvedValue(undefined);

    render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    await waitFor(() => {
      const button = screen.getByRole("button");
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockRemoveFromWatchlist).toHaveBeenCalledWith(
        "test-user-123",
        "test-drama"
      );
    });
  });

  it("should not render for unauthenticated users", () => {
    vi.mocked(require("../lib/auth").useAuth).mockReturnValueOnce({
      user: null,
      loading: false,
    });

    const { container } = render(
      <WatchlistButton slug="test-drama" title="Test Drama" image="test.jpg" />
    );

    expect(container.firstChild).toBeNull();
  });
});
