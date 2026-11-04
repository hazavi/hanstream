"use client";

import { usePathname } from "next/navigation";
import { SlideTabs, type SlideTabItem } from "@/components/ui/slide-tabs";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { AuthStatus } from "./AuthStatus";

const navigation: readonly SlideTabItem[] = [
  { value: "/", label: "Home", href: "/" },
  { value: "/popular", label: "Popular", href: "/popular" },
  { value: "/recently-added", label: "Latest", href: "/recently-added" },
  { value: "/recent-movies", label: "Movies", href: "/recent-movies" },
];

export function FloatingNav() {
  const pathname = usePathname();
  const selected = navigation.find(item => item.value === "/" ? pathname === "/" : pathname.startsWith(item.value))?.value ?? "";
  return <header className="site-header">
    <nav className="site-nav" aria-label="Main navigation">
      <SlideTabs items={navigation} value={selected} mode="navigation" label="Browse dramas" trailing={<><SearchBar compact/><AuthStatus/><ThemeToggle/></>}/>
    </nav>
  </header>;
}
