import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchBar } from "../components/SearchBar";
import { fetchSearchClient } from '../lib/api-client';

// Mock internal search client used for suggestions
vi.mock("@/lib/api-client", () => ({
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
  it('finishes loading and displays no results instead of hiding an endless spinner', async () => {
    render(<SearchBar/>);
    fireEvent.change(screen.getByRole('combobox'), {target:{value:'No matching title'}});
    expect(await screen.findByText('No dramas found.')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-busy','false');
  });
  it('shows request failures and lets a suggestion be selected', async () => {
    vi.mocked(fetchSearchClient).mockRejectedValueOnce(new Error('offline'));
    render(<SearchBar/>);
    fireEvent.change(screen.getByRole('combobox'), {target:{value:'Unavailable'}});
    expect(await screen.findByText('Search is unavailable. Please try again.')).toBeInTheDocument();
    vi.mocked(fetchSearchClient).mockResolvedValueOnce({results:[{title:'A Drama',image:'/poster.jpg','detail-link':'/drama-a-drama--2025'}]});
    fireEvent.change(screen.getByRole('combobox'), {target:{value:'A Drama'}});
    fireEvent.click(await screen.findByRole('option',{name:'A Drama'}));
    expect(mockPush).toHaveBeenCalledWith('/drama-a-drama--2025');
  });

  it("should update input value on type", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test drama" } });

    expect(input.value).toBe("test drama");
  });

  it("should navigate to search page on form submit", async () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=test%20query");
    });
  });

  it("should not submit empty search", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.submit(form!);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("should trim whitespace while preserving the query", async () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    const form = input.closest("form");

    fireEvent.change(input, { target: { value: "  test drama  " } });
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=test%20drama");
    });
  });

  it("should have search button", () => {
    render(<SearchBar />);
    // The button has no accessible name (icon only), so just query by role
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should trigger search on button click", async () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText(/search/i);
    // The button has no accessible name (icon only), so query by role only
    const button = screen.getByRole("button");

    fireEvent.change(input, { target: { value: "button test" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/search?q=button%20test");
    });
  });
});
