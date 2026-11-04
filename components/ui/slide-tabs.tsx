"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { LazyMotion, m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SlideTabItem = { value: string; label: string; href?: string; icon?: ReactNode };
type SlideTabsProps = {
  items?: readonly SlideTabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  mode?: "navigation" | "tabs";
  label?: string;
  id?: string;
  className?: string;
  trailing?: ReactNode;
};
type Position = { left: number; top: number; width: number; height: number; opacity: number };

const demoItems = ["Home", "Pricing", "Features", "Docs", "Blog"].map(label => ({ value: label, label }));
const loadFeatures = () => import("./slide-tabs-motion").then(module => module.default);

/** An outlined sliding selector, with real links for navigation and buttons for panels. */
export function SlideTabs({ items = demoItems, value, defaultValue, onValueChange, mode = "tabs", label = "Sections", id, className, trailing }: SlideTabsProps) {
  const generatedId = useId();
  const prefix = id || generatedId;
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.value ?? "");
  const selected = value ?? internalValue;
  const listRef = useRef<HTMLUListElement>(null);
  const tabsRef = useRef(new Map<string, HTMLAnchorElement | HTMLButtonElement>());
  const geometry = useRef(new Map<string, Position>());
  const hovered = useRef<string | undefined>(undefined);
  const reduceMotion = useReducedMotion();
  const [position, setPosition] = useState<Position>({ left: 0, top: 0, width: 0, height: 0, opacity: 0 });

  const measure = useCallback((key: string) => {
    const next = geometry.current.get(key) || { left: 0, top: 0, width: 0, height: 0, opacity: 0 };
    setPosition(previous => Object.keys(next).every(key => previous[key as keyof Position] === next[key as keyof Position]) ? previous : next);
  }, []);
  const reset = useCallback(() => measure(selected), [measure, selected]);

  useEffect(() => {
    const remeasure = () => {
      geometry.current.clear();
      for (const [key, element] of tabsRef.current) geometry.current.set(key, { left: element.offsetLeft, top: element.offsetTop, width: element.offsetWidth, height: element.offsetHeight, opacity: 1 });
      measure(hovered.current || selected);
    };
    remeasure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasure) : undefined;
    if (listRef.current) observer?.observe(listRef.current);
    for (const element of tabsRef.current.values()) observer?.observe(element);
    window.addEventListener("resize", remeasure);
    let active = true;
    void document.fonts?.ready.then(() => { if (active) remeasure(); });
    return () => { active = false; observer?.disconnect(); window.removeEventListener("resize", remeasure); };
  }, [measure, selected, items]);

  function select(key: string) {
    if (value === undefined) setInternalValue(key);
    onValueChange?.(key);
  }
  function onKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    if (mode !== "tabs" || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    hovered.current=undefined;
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    select(items[next].value);
    tabsRef.current.get(items[next].value)?.focus();
  }

  return <LazyMotion features={loadFeatures} strict>
    <ul ref={listRef} role={mode === "tabs" ? "tablist" : undefined} aria-label={label} className={cn("slide-tabs", className)} data-cursor-ready={position.width > 0 && position.opacity > 0} onPointerLeave={() => { hovered.current=undefined; reset(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) measure(hovered.current || selected); }}>
      {items.map((item, index) => {
        const active = selected === item.value;
        const shared = {
          className: "slide-tab",
          "data-selected": active,
          onClick: () => select(item.value),
          onFocus: () => measure(item.value),
          onPointerEnter: (event: PointerEvent) => { if (event.pointerType !== "touch") { hovered.current=item.value; measure(item.value); } },
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, index),
        };
        const content = <span className="slide-tab-label">{item.icon}{item.label}</span>;
        return <li key={item.value} role={mode === "tabs" ? "presentation" : undefined} className="slide-tab-item">
          {mode === "navigation" && item.href ? <Link {...shared} href={item.href} aria-current={active ? "page" : undefined} ref={element => { if (element) tabsRef.current.set(item.value, element); else tabsRef.current.delete(item.value); }}>{content}</Link> : <button {...shared} type="button" role="tab" id={`${prefix}-tab-${item.value}`} aria-selected={active} aria-controls={id ? `${prefix}-panel-${item.value}` : undefined} tabIndex={active || !items.some(item => item.value === selected) && index === 0 ? 0 : -1} ref={element => { if (element) tabsRef.current.set(item.value, element); else tabsRef.current.delete(item.value); }}>{content}</button>}
        </li>;
      })}
      {trailing && <li className="slide-tabs-tools" onPointerEnter={() => { hovered.current=undefined; reset(); }} onFocusCapture={reset}>{trailing}</li>}
      <m.li role="presentation" aria-hidden="true" className="slide-tabs-cursor" initial={false} animate={{ x: position.left, y: position.top, width: position.width, height: position.height, opacity: position.opacity }} transition={reduceMotion ? { duration: 0 } : { type: "tween", duration: .18, ease: "easeOut" }} />
    </ul>
  </LazyMotion>;
}
