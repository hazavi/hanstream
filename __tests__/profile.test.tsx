import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ProfileProvider, useProfile } from "../lib/profile";

beforeEach(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
    clear: () => { entries.clear(); },
  });
});

it("keeps a watchlist in local storage across provider mounts", async () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => <ProfileProvider>{children}</ProfileProvider>;
  const first = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(first.result.current.profile).not.toBeNull());
  await act(async () => first.result.current.addToWatchlist({ slug: "42", title: "Drama", status: "watching" }));
  expect(first.result.current.profile?.watchlist[0].slug).toBe("42");
  first.unmount();
  const second = renderHook(() => useProfile(), { wrapper });
  await waitFor(() => expect(second.result.current.profile?.watchlist[0].slug).toBe("42"));
});
it('persists watched episodes independently per season and supports marking them unwatched',async()=>{
  const wrapper=({children}:{children:React.ReactNode})=><ProfileProvider>{children}</ProfileProvider>;
  const first=renderHook(()=>useProfile(),{wrapper});
  await waitFor(()=>expect(first.result.current.profile).not.toBeNull());
  await act(async()=>{await first.result.current.setEpisodeWatched('drama','1',true);await first.result.current.setEpisodeWatched('drama','s1e1',true);await first.result.current.setEpisodeWatched('drama','s2e1',true);});
  expect(first.result.current.profile?.watchedEpisodes?.drama).toEqual(['s1e1','s2e1']);
  await act(async()=>first.result.current.setEpisodeWatched('drama','s1e1',false));
  first.unmount();const second=renderHook(()=>useProfile(),{wrapper});
  await waitFor(()=>expect(second.result.current.profile?.watchedEpisodes?.drama).toEqual(['s2e1']));
});
