import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EpisodesNavigation } from "../app/[slug]/episode/[episode]/EpisodesNavigation";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock formatRelativeTime
vi.mock("../lib/api", () => ({
  formatRelativeTime: (time: string) => time,
}));

describe("EpisodesNavigation Component", () => {
  const mockEpisodes = [
    { id: "/drama/episode/1", type: "SUB", time: "1 day ago" },
    { id: "/drama/episode/2", type: "SUB", time: "2 days ago" },
    { id: "/drama/episode/3", type: "DUB", time: "3 days ago" },
  ];

  it("should render all episodes", () => {
    render(
      <EpisodesNavigation
        episodes={mockEpisodes}
        currentEpisode="1"
        dramaSlug="test-drama"
      />
    );

    expect(screen.getByText("Episode 1")).toBeInTheDocument();
    expect(screen.getByText("Episode 2")).toBeInTheDocument();
    expect(screen.getByText("Episode 3")).toBeInTheDocument();
  });

  it("should display episode count", () => {
    render(
      <EpisodesNavigation
        episodes={mockEpisodes}
        currentEpisode="1"
        dramaSlug="test-drama"
      />
    );

    expect(screen.getByText("(3)")).toBeInTheDocument();
  });

  it("should highlight active episode", () => {
    render(
      <EpisodesNavigation
        episodes={mockEpisodes}
        currentEpisode="2"
        dramaSlug="test-drama"
      />
    );

    const episode2Link = screen.getByText("Episode 2").closest("a");
    expect(episode2Link).toHaveClass("bg-gradient-to-r");
  });

  it("should display episode types (SUB/DUB)", () => {
    render(
      <EpisodesNavigation
        episodes={mockEpisodes}
        currentEpisode="1"
        dramaSlug="test-drama"
      />
    );

    const subBadges = screen.getAllByText("SUB");
    expect(subBadges).toHaveLength(2);

    const dubBadge = screen.getByText("DUB");
    expect(dubBadge).toBeInTheDocument();
  });

  it("should show play icon for active episode", () => {
    render(
      <EpisodesNavigation
        episodes={mockEpisodes}
        currentEpisode="1"
        dramaSlug="test-drama"
      />
    );

    const activeEpisode = screen.getByText("Episode 1").closest("a");
    const playIcon = activeEpisode?.querySelector("svg");
    expect(playIcon).toBeInTheDocument();
  });

  it("should generate correct episode links", () => {
    render(
      <EpisodesNavigation
        episodes={mockEpisodes}
        currentEpisode="1"
        dramaSlug="test-drama"
      />
    );

    const episode1Link = screen.getByText("Episode 1").closest("a");
    expect(episode1Link).toHaveAttribute("href", "/test-drama/episode/1");

    const episode2Link = screen.getByText("Episode 2").closest("a");
    expect(episode2Link).toHaveAttribute("href", "/test-drama/episode/2");
  });

  it("should display release times", () => {
    render(
      <EpisodesNavigation
        episodes={mockEpisodes}
        currentEpisode="1"
        dramaSlug="test-drama"
      />
    );

    expect(screen.getByText("1 day ago")).toBeInTheDocument();
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
    expect(screen.getByText("3 days ago")).toBeInTheDocument();
  });
});
