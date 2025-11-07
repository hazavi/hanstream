import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoPlayer } from "../components/VideoPlayer";

describe("VideoPlayer Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render video player", () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        title="Test Episode"
        currentEpisode="1"
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
  });

  it("should set video source correctly", () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        title="Test Episode"
        currentEpisode="1"
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", "https://example.com/video.mp4");
  });

  it("should set title attribute", () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        title="Test Episode Title"
        currentEpisode="1"
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("title", "Test Episode Title");
  });

  it("should have allowFullScreen attribute", () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        title="Test Episode"
        currentEpisode="1"
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("allowFullScreen");
  });

  it("should render with aspect-video container", () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        title="Test Episode"
        currentEpisode="1"
      />
    );

    const videoContainer = container.querySelector(".aspect-video");
    expect(videoContainer).toBeInTheDocument();
  });

  it("should have proper styling classes", () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/video.mp4"
        title="Test Episode"
        currentEpisode="5"
      />
    );

    const videoContainer = container.querySelector(".aspect-video");
    expect(videoContainer).toHaveClass(
      "w-full",
      "rounded-2xl",
      "overflow-hidden"
    );
  });

  it("should handle different episode numbers", () => {
    const { container } = render(
      <VideoPlayer
        src="https://example.com/episode-10.mp4"
        title="Episode 10"
        currentEpisode="10"
      />
    );

    const iframe = container.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", "https://example.com/episode-10.mp4");
  });
});
