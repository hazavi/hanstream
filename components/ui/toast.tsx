"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Info, X } from "lucide-react";

type Toast = { id: string; message: string };
const empty: Toast[] = [];
let messages = empty;
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const recent = new Map<string, number>();
function publish(next: Toast[]) {
  messages = next;
  listeners.forEach((fn) => fn());
}
function dismiss(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  publish(messages.filter((item) => item.id !== id));
}
export function toast(message: string, id = message, duration = 5500) {
  if (typeof window === "undefined" || (recent.get(id) || 0) > Date.now())
    return;
  recent.set(id, Date.now() + 60_000);
  if (recent.size > 100) recent.delete(recent.keys().next().value!);
  const next = [...messages.filter((item) => item.id !== id), { id, message }];
  while (next.length > 3) {
    const old = next.shift()!;
    clearTimeout(timers.get(old.id));
    timers.delete(old.id);
  }
  publish(next);
  timers.set(
    id,
    setTimeout(() => dismiss(id), duration),
  );
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function ToastViewport() {
  const items = useSyncExternalStore(
    subscribe,
    () => messages,
    () => empty,
  );
  return (
    <section aria-label="Notifications" className="toast-viewport">
      {items.map((item) => (
        <div key={item.id} role="status" className="toast-message">
          <Info size={17} aria-hidden="true" className="shrink-0" />
          <p>{item.message}</p>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss notification"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </section>
  );
}
export function NoticeToast({
  message,
  id,
  enabled = true,
}: {
  message: string;
  id?: string;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (enabled) toast(message, id);
  }, [message, id, enabled]);
  return null;
}
