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
