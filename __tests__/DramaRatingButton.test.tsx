import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { DramaRatingButton } from "../components/DramaRatingButton";

// Mock Firebase auth (use project alias to match component imports)
vi.mock("@/lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { uid: "test-user-123" },
    loading: false,
  })),
}));
import { useAuth } from "@/lib/auth";

// Mock profile hook with finished watchlist item (use project alias)
const mockRateItem = vi.fn();
let currentProfile: any = {
  watchlist: [{ slug: "test-drama", status: "finished", rating: undefined }],
  ratings: {},
};

vi.mock("@/lib/profile", () => ({
  useProfile: () => ({
    profile: currentProfile,
    rateItem: mockRateItem,
  }),
}));

describe("DramaRatingButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentProfile = {
      watchlist: [
        { slug: "test-drama", status: "finished", rating: undefined },
      ],
      ratings: {},
    };
  });

  it("should render add rating button when finished without rating", () => {
    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(screen.getByText(/add rating/i)).toBeInTheDocument();
  });

  it("should open rating modal when clicked", async () => {
    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText(/your rating/i)).toBeInTheDocument();
    });
  });

  it("should render existing rating badge when rating present", () => {
    currentProfile = {
      watchlist: [{ slug: "test-drama", status: "finished", rating: 7 }],
      ratings: {},
    };
    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });

  it("should submit rating and close modal", async () => {
    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);
    fireEvent.click(screen.getByRole("button"));
    // Scope search to the modal to avoid matching the trigger button text
    const modalHeader = await screen.findByText(/your rating/i);
    const modal = modalHeader.closest(".search-modal") as HTMLElement;
    const saveBtn = within(modal).getByRole("button", { name: /add rating/i });
    // Range input sets default 10, simulate change to 8
    const range = screen.getByRole("slider");
    fireEvent.change(range, { target: { value: "8" } });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockRateItem).toHaveBeenCalledWith("test-drama", 8);
    });
  });

  it("should update rating when editing existing one", async () => {
    currentProfile = {
      watchlist: [{ slug: "test-drama", status: "finished", rating: 6 }],
      ratings: {},
    };
    render(<DramaRatingButton slug="test-drama" title="Test Drama" />);
    // Click badge
    fireEvent.click(screen.getByRole("button"));
    const slider = await screen.findByRole("slider");
    fireEvent.change(slider, { target: { value: "9" } });
    const updateBtn = screen.getByText(/update rating/i);
    fireEvent.click(updateBtn);
    await waitFor(() => {
      expect(mockRateItem).toHaveBeenCalledWith("test-drama", 9);
    });
  });

  it("should not render when item not finished", () => {
    currentProfile = {
      watchlist: [{ slug: "test-drama", status: "watching" }],
      ratings: {},
    };
    const { container } = render(
      <DramaRatingButton slug="test-drama" title="Test Drama" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should not render for unauthenticated users", () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      user: null,
      loading: false,
    } as any);
    const { container } = render(
      <DramaRatingButton slug="test-drama" title="Test Drama" />
    );
    expect(container.firstChild).toBeNull();
  });

  // (Merged unauthenticated test above)
});
