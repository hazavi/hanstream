"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Server, Check, LoaderCircle } from "lucide-react";
import { MEDIA_SANDBOX, MEDIA_PERMISSIONS, safeEmbedUrl } from "@/lib/embed";
import { isDesktop } from "@/lib/native";
import { NativePlayer } from "./NativePlayer";
import { toast } from "./ui/toast";

export function EpisodePlayer({
  video,
  servers = [],
  title,
  caption,
  navigation,
}: {
  video: string;
  servers?: { name: string; url: string }[];
  title: string;
  caption?: ReactNode;
  navigation?: ReactNode;
}) {
  const [selected, setSelected] = useState(() => safeEmbedUrl(video));
  const [status, setStatus] = useState<"loading" | "ready" | "slow" | "failed">(
    "loading",
  );
  const [reload, setReload] = useState(0);
  const [mode, setMode] = useState<"pending" | "desktop" | "web">("pending");
  const failedServers = useRef(new Set<string>());
  useEffect(() => setMode(isDesktop() ? "desktop" : "web"), []);
  const availableServers = (Array.isArray(servers) ? servers : []).filter(
    (server) => server && safeEmbedUrl(server.url),
  );
  // A saved server index can point to a different or broken upload after a source
  // update. Start each episode with the reader's current preferred server.
  useEffect(() => {
    const timer = setTimeout(
      () => setStatus((current) => (current === "loading" ? "slow" : current)),
      12_000,
    );
    return () => clearTimeout(timer);
  }, [selected, reload]);
  useEffect(() => {
    if (status === "slow" || status === "failed")
      toast(
        "This video host is taking longer to respond. Try another listed server; your episode stays selected.",
        "player-delay",
      );
  }, [status]);
  function choose(index: number, automatic = false) {
    const server = availableServers[index];
    if (!server) return;
    if (!automatic) failedServers.current.clear();
    setStatus("loading");
    setSelected(safeEmbedUrl(server.url));
    setReload((value) => value + 1);
  }
  function failed() {
    if (selected) failedServers.current.add(selected);
    const next = availableServers.findIndex(
      (server) => !failedServers.current.has(server.url),
    );
    if (next >= 0) {
      choose(next, true);
      toast(
        "This server could not load. Trying another listed server.",
        "player-fallback",
      );
    } else setStatus("failed");
  }
  return (
    <div>
      <div className="aspect-video relative video-container">
        {selected ? (
          mode === "desktop" ? (
            <NativePlayer
              url={selected}
              reload={reload}
              title={title}
              onLoaded={() => setStatus("ready")}
              onFailure={failed}
            />
          ) : mode === "web" ? (
            <iframe
              key={selected + ":" + reload}
              src={selected}
              title={title}
              sandbox={MEDIA_SANDBOX}
              className="h-full w-full rounded-2xl"
              allow={MEDIA_PERMISSIONS}
              referrerPolicy="no-referrer"
              onLoad={() => setStatus("ready")}
              onError={failed}
            />
          ) : null
        ) : (
          <div
            className="flex h-full items-center justify-center gap-3 rounded-2xl glass-card p-6 text-center text-secondary"
            role="status"
          >
            <LoaderCircle
              size={18}
              className="animate-spin"
              aria-hidden="true"
            />
            Checking for an available stream…
          </div>
        )}
        {selected && status === "loading" && (
          <div
            className="pointer-events-none absolute top-3 left-3 rounded-lg bg-black/80 px-3 py-2 text-xs text-white"
            role="status"
          >
            Loading player...
          </div>
        )}
      </div>
      {(caption || navigation) && <div className="watch-caption-row">{caption}{navigation}</div>}
      {availableServers.length > 0 && (
        <div className="watch-toolbar">
          {availableServers.length > 0 && (
            <div
              className="stream-server-controls"
              aria-label="Streaming servers"
            >
              <span className="stream-server-label">
                <Server size={14} aria-hidden="true" />
                <span className="stream-server-title">Servers</span>
              </span>
              {availableServers.map((server, index) => (
                <button
                  key={server.url}
                  type="button"
                  aria-pressed={selected === server.url}
                  onClick={() => choose(index)}
                  className="stream-server-button"
                >
                  {selected === server.url && (
                    <Check size={13} aria-hidden="true" />
                  )}
                  Server {index + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
