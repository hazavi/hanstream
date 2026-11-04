import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { FloatingNav } from '../components/FloatingNav';
import { ProfileProvider } from '../lib/profile';
vi.mock('next/link',()=>({default:(props:ComponentProps<'a'>)=><a {...props}/>}));
vi.mock('next/navigation',()=>({usePathname:()=>'/popular',useRouter:()=>({push:vi.fn()})}));
vi.mock('../lib/api-client',()=>({fetchSearchClient:vi.fn().mockResolvedValue({results:[]})}));
afterEach(cleanup);

it('keeps navigation and all three tools in one compact bar, with an accessible search popover', () => {
  const {container}=render(<ProfileProvider><FloatingNav/></ProfileProvider>);
  expect(container.querySelectorAll('.slide-tabs')).toHaveLength(1);
  for(const name of ['Home','Popular','Latest','Movies']) expect(screen.getByRole('link',{name})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'My library'})).toBeInTheDocument();
  expect(screen.queryByText('HanStream')).toBeNull();
  expect(screen.getByRole('link',{name:'Popular'})).toHaveAttribute('aria-current','page');
  expect(screen.queryByRole('combobox')).toBeNull();
  const trigger=screen.getByRole('button',{name:'Open drama search'});
  fireEvent.click(trigger);
  const input=screen.getByRole('combobox',{name:'Search dramas'});
  expect(input).toHaveFocus();
  fireEvent.keyDown(input,{key:'Escape'});
  expect(screen.queryByRole('combobox')).toBeNull();
  expect(trigger).toHaveFocus();
  fireEvent.keyDown(window,{key:'k',ctrlKey:true});
  expect(screen.getByRole('combobox',{name:'Search dramas'})).toHaveFocus();
});
