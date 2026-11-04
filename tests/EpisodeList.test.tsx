import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EpisodeList } from "../components/EpisodeList";

vi.mock('next/link', () => ({ default: ({ prefetch: _prefetch, ...props }: React.ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props}/> }));
vi.mock('next/image', () => ({ default: ({ fill: _fill, priority: _priority, ...props }: React.ComponentProps<'img'> & { fill?: boolean; priority?: boolean }) => <img {...props}/> }));
afterEach(cleanup);
const episodes = [
  { id: 's1e1', season: 1, episode: 1, title: 'A fresh start', description: 'The first episode story.', image: 'https://pictures.example/one.jpg' },
  { id: 's1e2', season: 1, episode: 2, title: 'Coming home', description: 'The second episode story.' },
  { id: 's2e1', season: 2, episode: 1, title: 'A new season', available: false, time: '2099-01-01' },
];
it('shows named image cards, current selection, exact number search, sorting in list-only view', () => {
  const { container } = render(<EpisodeList episodes={episodes} currentEpisode="s1e1" slug="fixture" />);
  expect(screen.getByRole('link',{name:'Episode 1: A fresh start'})).toHaveAttribute('aria-current','page');
  expect(screen.getByText('The first episode story.')).toBeInTheDocument();
  expect(container.querySelector('img')).toHaveAttribute('src','https://pictures.example/one.jpg');
  fireEvent.change(screen.getByRole('searchbox',{name:'Find episode'}),{target:{value:'2'}});
  expect(screen.queryByRole('link',{name:'Episode 1: A fresh start'})).toBeNull();
  expect(screen.getByRole('link',{name:'Episode 2: Coming home'})).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'Sort episodes descending'}));
  expect(screen.getAllByRole('link')[0]).toHaveTextContent('Coming home');
  expect(screen.queryByRole('button',{name:'Show episode grid'})).toBeNull();
});
it('keeps future seasons visible without offering playback and reports no search matches', () => {
  render(<EpisodeList episodes={episodes} currentEpisode="s1e1" slug="fixture" />);
  fireEvent.change(screen.getByRole('combobox',{name:'Season'}),{target:{value:'2'}});
  expect(screen.getByText('Upcoming')).toBeInTheDocument();
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Missing'}});
  expect(screen.getByText('No episodes match your search.')).toBeInTheDocument();
});
it('limits mounted cards and opens the range containing the playing episode', () => {
  const many = Array.from({length:150},(_,index)=>({id:`s1e${index+1}`,title:`Chapter ${index+1}`}));
  render(<EpisodeList episodes={many} currentEpisode="s1e104" slug="fixture" />);
  expect(screen.getAllByRole('link')).toHaveLength(50);
  expect(screen.getByRole('link',{name:'Episode 104: Chapter 104'})).toHaveAttribute('aria-current','page');
  expect(screen.getByRole('combobox',{name:'Episode range'})).toHaveValue('2');
});
it('uses the poster for released episodes without stills, and a placeholder for unannounced episodes', () => {
  const { container } = render(<EpisodeList episodes={[{ id: '1', title: 'Released', time: '2025-01-01' }, { id: '2', title: 'Not announced', available: false }]} currentEpisode="1" slug="fixture" poster="https://pictures.example/poster.jpg" coverTitle="Fixture" />);
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://pictures.example/poster.jpg');
  expect(screen.getByText('Upcoming')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Not announced/ })).toBeNull();
});
