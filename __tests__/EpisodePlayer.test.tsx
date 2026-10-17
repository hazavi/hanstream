import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { EpisodePlayer } from "../components/EpisodePlayer";

it("changes the iframe when a different streaming server is selected", () => {
  render(<EpisodePlayer title="Fixture episode 2" video="https://player-one.example/2" servers={[{ name: "Primary Player", url: "https://player-one.example/2" }, { name: "Alternate Player", url: "https://player-two.example/2" }]} />);
  expect(screen.getByTitle("Fixture episode 2")).toHaveAttribute("src", "https://player-one.example/2");
  expect(screen.queryByText(/Primary Player|Alternate Player/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Server 2" }));
  expect(screen.getByTitle("Fixture episode 2")).toHaveAttribute("src", "https://player-two.example/2");
  expect(screen.getByRole("button", { name: "Server 2" })).toHaveAttribute("aria-pressed", "true");
});

it("shows the unavailable message without loading an iframe when no stream exists", () => {
  const { container } = render(<EpisodePlayer title="Fixture episode 2" video="" />);
  expect(screen.getByText("This episode is currently unavailable.")).toBeInTheDocument();
  expect(container.querySelector("iframe")).toBeNull();
});
