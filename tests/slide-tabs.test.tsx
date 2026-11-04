import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ComponentProps, ReactNode } from 'react';
import { SlideTabs } from '../components/ui/slide-tabs';

// Test our cursor measurements without depending on a browser animation clock.
vi.mock('framer-motion', () => ({
  LazyMotion: ({children}:{children:ReactNode}) => children,
  useReducedMotion: () => false,
  m: {li: ({animate,className,role}:ComponentProps<'li'> & {animate:{x:number;width:number}}) => <li className={className} role={role} aria-hidden="true" data-left={animate.x} data-width={animate.width}/>},
}));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props}/> }));

const items = [{value:'info',label:'Show info'},{value:'cast',label:'Cast'},{value:'trailer',label:'Trailer'}];
let resized: () => void;
let castWidth = 72;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function(this:HTMLElement) {
    return this.classList.contains('slide-tab') ? this.textContent === 'Cast' ? castWidth : 100 : 300;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(36);
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function(this:HTMLElement) { return this.textContent === 'Cast' ? 106 : this.textContent === 'Trailer' ? 184 : 4; });
  vi.stubGlobal('ResizeObserver', class { constructor(callback:()=>void) { resized=callback; } observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); castWidth=72; });

it('moves the cursor to a hovered tab and returns to the selection without changing panels', () => {
  const change=vi.fn(); const {container}=render(<SlideTabs items={items} id="fixture" label="Drama media" onValueChange={change}/>);
  const cursor=container.querySelector('.slide-tabs-cursor');
  expect(cursor).toHaveAttribute('data-left','4');
  fireEvent.pointerEnter(screen.getByRole('tab',{name:'Cast'}),{pointerType:'mouse'});
  expect(cursor).toHaveAttribute('data-left','106');
  expect(cursor).toHaveAttribute('data-width','72');
  expect(change).not.toHaveBeenCalled();
  fireEvent.pointerLeave(screen.getByRole('tablist'));
  expect(cursor).toHaveAttribute('data-left','4');
});

it('switches panels by keyboard, keeps one tab stop, and connects panels to their labels', () => {
  render(<SlideTabs items={items} id="fixture"/>);
  const info=screen.getByRole('tab',{name:'Show info'});
  fireEvent.keyDown(info,{key:'ArrowRight'});
  const cast=screen.getByRole('tab',{name:'Cast'});
  expect(cast).toHaveFocus();
  expect(cast).toHaveAttribute('aria-selected','true');
  expect(cast).toHaveAttribute('aria-controls','fixture-panel-cast');
  expect(info).toHaveAttribute('tabindex','-1');
  fireEvent.keyDown(cast,{key:'End'});
  expect(screen.getByRole('tab',{name:'Trailer'})).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('tab',{name:'Trailer'}),{key:'ArrowRight'});
  expect(info).toHaveFocus();
});

it('remeasures the selected tab when fonts or responsive layout change its width', () => {
  const {container}=render(<SlideTabs items={items} defaultValue="cast"/>);
  castWidth=94;
  act(()=>resized());
  expect(container.querySelector('.slide-tabs-cursor')).toHaveAttribute('data-width','94');
});

it('renders real navigation links and follows the route selected by its parent', () => {
  const links=[{value:'/',label:'Home',href:'/'},{value:'/popular',label:'Popular',href:'/popular'}];
  const {rerender}=render(<SlideTabs mode="navigation" items={links} value="/"/>);
  expect(screen.getByRole('link',{name:'Home'})).toHaveAttribute('aria-current','page');
  expect(screen.getByRole('link',{name:'Popular'})).toHaveAttribute('href','/popular');
  rerender(<SlideTabs mode="navigation" items={links} value="/popular"/>);
  expect(screen.getByRole('link',{name:'Popular'})).toHaveAttribute('aria-current','page');
  expect(screen.getByRole('link',{name:'Home'})).not.toHaveAttribute('aria-current');
  expect(screen.queryByRole('tab')).toBeNull();
});
