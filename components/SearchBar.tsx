"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, LoaderCircle } from "lucide-react";
import { fetchSearchClient } from "@/lib/api-client";
import type { SearchResultItem } from "@/lib/api-types";
import { Artwork } from "./Artwork";
export function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const listId = useId();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (query.trim().length < 2) { setSuggestions([]); setLoading(false); setOpen(false); setError(""); return; }
    const timer = setTimeout(async () => {
      setLoading(true); setOpen(true); setError("");
      try {
        const data = await fetchSearchClient(query.trim(), 1, controller.signal);
        if (active) { setSuggestions(data.results.slice(0, 8)); setSelected(-1); }
      } catch {
        if (active) { setSuggestions([]); setError("Search is unavailable. Please try again."); }
      } finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [query]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const shortcut = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); } };
    document.addEventListener("mousedown", close); window.addEventListener("keydown", shortcut);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", shortcut); };
  }, []);
  const search = () => { if (query.trim()) { router.push("/search?q=" + encodeURIComponent(query.trim())); setOpen(false); setQuery(''); } };
  const choose = (item: SearchResultItem) => { router.push(item["detail-link"]); setOpen(false); setQuery(""); };
  return <div ref={container} className="relative">
    <form className="search-bar" onSubmit={event => { event.preventDefault(); search(); }}><div className="relative flex items-center">
      <input ref={input} type="text" role="combobox" aria-label="Search dramas" aria-autocomplete="list" aria-controls={listId} aria-expanded={open} aria-busy={loading} aria-activedescendant={selected >= 0 ? listId + '-' + selected : undefined} placeholder="Search dramas..." className="search-input w-full pr-28" autoComplete="off" value={query} onChange={event => { setQuery(event.target.value); setSelected(-1); }} onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); setSelected(-1); }
        if (open && event.key === "ArrowDown") { event.preventDefault(); setSelected(value => Math.min(suggestions.length - 1, value + 1)); }
        if (open && event.key === "ArrowUp") { event.preventDefault(); setSelected(value => Math.max(-1, value - 1)); }
        if (open && event.key === "Enter" && selected >= 0 && suggestions[selected]) { event.preventDefault(); choose(suggestions[selected]); }
      }} />
      <span className="search-icon">{loading ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18}/> : <Search aria-hidden="true" size={18}/>}</span>
      <span className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex text-[9px] text-secondary gap-1"><kbd>Ctrl</kbd><kbd>K</kbd></span>
      <button type="submit" className="search-button" aria-label="Search"><ArrowRight size={16} aria-hidden="true"/></button>
    </div></form>
    {open && <div className="search-dropdown absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto">
      {loading ? <p role="status" className="p-4 text-sm text-secondary">Searching dramas...</p> : error ? <p role="status" className="p-4 text-sm text-secondary">{error}</p> : !suggestions.length ? <p role="status" className="p-4 text-sm text-secondary">No dramas found.</p> : null}
      <ul id={listId} role="listbox" aria-label="Drama suggestions">{!loading && suggestions.map((item, index) => <li key={item["detail-link"]} id={listId + '-' + index} role="option" aria-selected={selected === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)} className={"search-dropdown-item flex items-center gap-3 p-3 cursor-pointer " + (selected === index ? "surface" : "")}><div className="relative w-9 aspect-[2/3] rounded-md overflow-hidden shrink-0"><Artwork sources={[item.image]} alt=""/></div><span className="text-sm font-medium flex-1">{item.title}</span><ArrowRight size={14} aria-hidden="true"/></li>)}</ul>
    </div>}
  </div>;
}
