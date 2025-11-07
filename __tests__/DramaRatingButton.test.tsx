import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DramaRatingButton } from "../components/DramaRatingButton";

// Mock Firebase auth
vi.mock("../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { uid: "test-user-123" },
    loading: false,
  })),
}));

// Mock Firebase functions
const mockGetRating = vi.fn();
const mockRateDrama = vi.fn();

vi.mock("../lib/profile", () => ({
  getRating: (...args: any[]) => mockGetRating(...args),
  rateDrama: (...args: any[]) => mockRateDrama(...args),
}));

describe("DramaRatingButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render rating button", () => {
    mockGetRating.mockResolvedValue(null);

    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should display star icon", async () => {
    mockGetRating.mockResolvedValue(null);

    const { container } = render(
      <DramaRatingButton slug="test-drama" title="Test Drama" />
    );

    await waitFor(() => {
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  it("should show current rating when available", async () => {
    mockGetRating.mockResolvedValue(8);

    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);

    await waitFor(() => {
      expect(screen.getByText("8")).toBeInTheDocument();
    });
  });

  it("should show rate text when no rating exists", async () => {
    mockGetRating.mockResolvedValue(null);

    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);

    await waitFor(() => {
      expect(screen.getByText(/rate/i)).toBeInTheDocument();
    });
  });

  it("should open rating modal when clicked", async () => {
    mockGetRating.mockResolvedValue(null);

    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      // Check for rating options 1-10
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });

  it("should submit rating when option is selected", async () => {
    mockGetRating.mockResolvedValue(null);
    mockRateDrama.mockResolvedValue(undefined);

    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      const rating8 = screen.getByText("8");
      fireEvent.click(rating8);
    });

    await waitFor(() => {
      expect(mockRateDrama).toHaveBeenCalledWith(
        "test-user-123",
        "test-drama",
        8
      );
    });
  });

  it("should update displayed rating after submission", async () => {
    mockGetRating.mockResolvedValue(null);
    mockRateDrama.mockResolvedValue(undefined);

    const { rerender } = render(
      <DramaRatingButton slug="test-drama" title="Test Drama" />
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);

    await waitFor(() => {
      const rating7 = screen.getByText("7");
      fireEvent.click(rating7);
    });

    // Simulate state update
    mockGetRating.mockResolvedValue(7);
    rerender(<DramaRatingButton slug="test-drama" title="Test Drama" />);

    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
  });

  it("should not render for unauthenticated users", () => {
    vi.mocked(require("../lib/auth").useAuth).mockReturnValueOnce({
      user: null,
      loading: false,
    });

    const { container } = render(
      <DramaRatingButton slug="test-drama" title="Test Drama" />
    );

    expect(container.firstChild).toBeNull();
  });
});
