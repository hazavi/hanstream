import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchBar } from "../components/SearchBar";

// Mock internal search client used for suggestions
vi.mock("@/lib/api", () => ({
  fetchSearchClient: vi.fn(async () => ({ results: [] })),
}));

// Mock Next.js router
const mockPush = vi.fn();
const mockPathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}));

describe("SearchBar Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render search input", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toBeInTheDocument();
  });

  it("should update input value on type", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test drama" } });

    expect(input.value).toBe("test drama");
  });

  it("should navigate to search page on form submit (hyphenated query)", async () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=test-query");
    });
  });

  it("should not submit empty search", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.submit(form!);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should trim whitespace and hyphenate", async () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "  test drama  " } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=test-drama");
    });
  });

  it("should have search button", () => {
    render(<SearchBar />);
    // The button has no accessible name (icon only), so just query by role
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should trigger search on button click (hyphenated)", async () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    // The button has no accessible name (icon only), so query by role only
    const button = screen.getByRole("button");

    fireEvent.change(input, { target: { value: "button test" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=button-test");
    });
  });
});
