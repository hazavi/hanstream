import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DramaCard } from "../components/DramaCard";
import type { RecentItem, PopularItem } from "../lib/api";

// Mock Next.js Image
vi.mock("next/image", () => ({
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt} />;
  },
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock formatRelativeTime
vi.mock("../lib/api", () => ({
  formatRelativeTime: (date: string) => "2 hours ago",
}));

describe("DramaCard Component - Recent Variant", () => {
  const mockRecentDrama: RecentItem = {
    "episode-link": "/test-drama/episode/5",
    episode_number: 5,
    image: "https://example.com/image.jpg",
    time: "2024-01-01T12:00:00Z",
    title: "Test Drama",
    type: "SUB",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render recent drama card", () => {
    render(<DramaCard item={mockRecentDrama} variant="recent" />);

    expect(screen.getByText("Test Drama")).toBeInTheDocument();
  });

  it("should display drama image", () => {
    render(<DramaCard item={mockRecentDrama} variant="recent" />);

    const image = screen.getByAltText("Test Drama");
    expect(image).toBeInTheDocument();
  });

  it("should link to drama detail page", () => {
    render(<DramaCard item={mockRecentDrama} variant="recent" />);

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
  });

  it("should display episode number badge", () => {
    render(<DramaCard item={mockRecentDrama} variant="recent" />);
    // Badge shows as "EP 5" in the component
    expect(screen.getByText(/EP\s*5/)).toBeInTheDocument();
  });

  it("should display SUB badge", () => {
    render(<DramaCard item={mockRecentDrama} variant="recent" />);

    expect(screen.getByText("SUB")).toBeInTheDocument();
  });

  it("should display relative time", () => {
    render(<DramaCard item={mockRecentDrama} variant="recent" />);

    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });
});

describe("DramaCard Component - Popular Variant", () => {
  const mockPopularDrama: PopularItem = {
    "detail-link": "/popular-drama",
    image: "https://example.com/popular.jpg",
    title: "Popular Drama",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render popular drama card", () => {
    render(<DramaCard item={mockPopularDrama} variant="popular" />);

    expect(screen.getByText("Popular Drama")).toBeInTheDocument();
  });

  it("should display drama image", () => {
    render(<DramaCard item={mockPopularDrama} variant="popular" />);

    const image = screen.getByAltText("Popular Drama");
    expect(image).toBeInTheDocument();
  });

  it("should not display episode number for popular variant", () => {
    render(<DramaCard item={mockPopularDrama} variant="popular" />);

    // Popular items don't have episode numbers
    const badges = screen.queryAllByText(/^\d+$/);
    expect(badges.length).toBe(0);
  });
});
