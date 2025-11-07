import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchBar } from "../components/SearchBar";

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

  it("should navigate to search page on form submit", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.submit(form!);

    expect(mockPush).toHaveBeenCalledWith("/search?q=test%20query");
  });

  it("should not submit empty search", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.submit(form!);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should trim whitespace from search query", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "  test drama  " } });
    fireEvent.submit(form!);

    expect(mockPush).toHaveBeenCalledWith("/search?q=test%20drama");
  });

  it("should have search button", () => {
    render(<SearchBar />);

    const button = screen.getByRole("button", { name: /search/i });
    expect(button).toBeInTheDocument();
  });

  it("should trigger search on button click", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const button = screen.getByRole("button", { name: /search/i });

    fireEvent.change(input, { target: { value: "button test" } });
    fireEvent.click(button);

    expect(mockPush).toHaveBeenCalledWith("/search?q=button%20test");
  });
});
