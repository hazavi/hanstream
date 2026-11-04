import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { EpisodePlayer } from "../components/EpisodePlayer";
import { safeEmbedUrl } from '../lib/embed';

it("changes the iframe when a different streaming server is selected", () => {
  render(<EpisodePlayer title="Fixture episode 2" video="https://player-one.example/2" servers={[{ name: "Primary Player", url: "https://player-one.example/2" }, { name: "Alternate Player", url: "https://player-two.example/2" }]} />);
  expect(screen.getByTitle("Fixture episode 2")).toHaveAttribute("src", "https://player-one.example/2");
  expect(screen.queryByText(/Primary Player|Alternate Player/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Server 2" }));
  expect(screen.getByTitle("Fixture episode 2")).toHaveAttribute("src", "https://player-two.example/2");
  expect(screen.getByRole("button", { name: "Server 2" })).toHaveAttribute("aria-pressed", "true");
});

it('isolates the player and rejects executable, insecure, and local frame URLs', () => {
  for (const url of ['javascript:alert(1)','data:text/html,example','http://player.example/e/1','https://127.0.0.1/','https://[::1]/','https://localhost/','https://media.internal/','https://user:pass@player.example/']) expect(safeEmbedUrl(url)).toBeUndefined();
  const {container}=render(<EpisodePlayer title="Episode" video="https://player.example/e/1" servers={[{name:'Bad',url:'javascript:alert(1)'}]}/>);
  expect(container.querySelector('iframe')).toHaveAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
  expect(container.querySelector('iframe')?.getAttribute('sandbox')).not.toMatch(/allow-(?:popups|top-navigation|downloads)/);
  expect(container.querySelector('[aria-label="Streaming servers"]')).toBeNull();
});

it("shows the unavailable message without loading an iframe when no stream exists", () => {
  const { container } = render(<EpisodePlayer title="Fixture episode 2" video="" />);
  expect(screen.getByText("This episode is currently unavailable.")).toBeInTheDocument();
  expect(container.querySelector("iframe")).toBeNull();
});
