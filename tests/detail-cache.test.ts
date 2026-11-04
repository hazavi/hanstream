import { expect, it } from 'vitest';
import { detailNeedsRefresh, mergeDramaResponse } from '../lib/detail-cache';

const rich = {result:{title:'Drama',image:'https://pictures.example/poster.jpg',description:'Published summary',meta:{Episodes:12,Country:'Korea'},cast:[{name:'Actor'}],episodes:[{episode:1,episode_link:'/drama/episode/1'}],detailsUnavailable:false}};
it('preserves good fields when a later source request returns partial data', () => {
  const merged=mergeDramaResponse(rich,{result:{title:'Drama',image:'/file.svg',description:'',meta:{Country:''},cast:[],episodes:[],detailsUnavailable:true}});
  expect(merged.result).toMatchObject(rich.result);
  expect(detailNeedsRefresh(merged)).toBe(false);
});
it('accepts published changes and expires an incomplete result quickly', () => {
  const merged=mergeDramaResponse(rich,{result:{description:'Updated summary',episodes:[{episode:2,episode_link:'/drama/episode/2'}]}});
  expect(merged.result?.description).toBe('Updated summary');
  expect(merged.result?.episodes?.[0].episode).toBe(2);
  expect(detailNeedsRefresh({result:{title:'Drama',description:'Summary',image:'/file.svg'}})).toBe(true);
  expect(detailNeedsRefresh({result:{...rich.result,refreshPending:true}})).toBe(true);
});

it('keeps published episode names and cast photos when a fallback only returns numbers and names', () => {
  const previous={result:{episodes:[{season:1,episode:1,episode_link:'/drama/episode/s1e1',title:'Published episode name',image:'https://pictures.example/still.jpg'}],cast:[{name:'Actor',character:'Lead',image:'https://pictures.example/actor.jpg'}]}};
  const merged=mergeDramaResponse(previous,{result:{episodes:[{season:1,episode:1,episode_link:'/drama/episode/s1e1'}],cast:[{name:'Actor'}]}});
  expect(merged.result?.episodes?.[0]).toMatchObject(previous.result.episodes[0]);
  expect(merged.result?.cast?.[0]).toMatchObject(previous.result.cast[0]);
});
