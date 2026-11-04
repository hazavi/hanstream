import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ProfileProvider} from '../lib/profile';
import {EpisodeList} from '../components/EpisodeList';
vi.mock('next/link',()=>({default:({prefetch:_prefetch,...props}:React.ComponentProps<'a'>&{prefetch?:boolean})=><a {...props}/>}));
vi.mock('next/image',()=>({default:({fill:_fill,priority:_priority,...props}:React.ComponentProps<'img'>&{fill?:boolean;priority?:boolean})=><img {...props}/>}));

afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('keeps saved history and the playing indicator without manual watched buttons',async()=>{
  const saved=JSON.stringify({watchedEpisodes:{drama:['s1e2']}});
  vi.stubGlobal('localStorage',{getItem:()=>saved,setItem:vi.fn()});
  render(<ProfileProvider><EpisodeList episodes={[{id:'s1e1',title:'First'},{id:'s1e2',title:'Second'}]} currentEpisode="s1e1" slug="drama"/></ProfileProvider>);
  await waitFor(()=>expect(screen.getByRole('link',{name:'Episode 2: Second'}).parentElement).toHaveClass('is-watched'));
  expect(screen.getByRole('link',{name:'Episode 1: First'})).toHaveAttribute('aria-current','page');
  expect(screen.queryByRole('button',{name:/watched/i})).toBeNull();
});
