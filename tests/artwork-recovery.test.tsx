import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { Artwork } from '../components/Artwork';
import { clearArtworkCache } from '../lib/artwork-cache';
vi.mock('next/image',()=>({default:({fill:_fill,priority:_priority,...props}:ComponentProps<'img'>&{fill?:boolean;priority?:boolean})=><img {...props}/>}));
afterEach(()=>{cleanup();clearArtworkCache();vi.useRealTimers();});

it('shares a recovered image with duplicate cards and remembers it when the card remounts', () => {
  const sources=['https://pictures.example/broken.jpg','https://pictures.example/good.jpg'];
  const page=render(<><Artwork sources={sources} alt="One"/><Artwork sources={sources} alt="Two"/></>);
  fireEvent.error(screen.getByAltText('One'));
  fireEvent.load(screen.getByAltText('One'));
  expect(screen.getByAltText('Two')).toHaveAttribute('src',sources[1]);
  page.unmount(); render(<Artwork sources={sources} alt="Again"/>);
  expect(screen.getByAltText('Again')).toHaveAttribute('src',sources[1]);
});
it('makes one delayed recovery attempt after a transient image failure', async () => {
  vi.useFakeTimers();
  render(<Artwork sources={['https://pictures.example/temporary.jpg']} alt="Poster"/>);
  fireEvent.error(screen.getByAltText('Poster'));
  expect(screen.getByText('Artwork unavailable')).toBeInTheDocument();
  await act(()=>vi.advanceTimersByTimeAsync(6000));
  expect(screen.getByAltText('Poster')).toHaveAttribute('src','https://pictures.example/temporary.jpg');
  fireEvent.error(screen.getByAltText('Poster'));
  await act(()=>vi.advanceTimersByTimeAsync(60_000));
  expect(screen.getByText('Artwork unavailable')).toBeInTheDocument();
});
