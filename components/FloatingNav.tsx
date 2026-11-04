"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard } from "lucide-react";
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
      <Link href="/" className="site-brand" aria-label="HanStream home"><span className="site-brand-icon"><Clapperboard size={19} strokeWidth={1.7} aria-hidden="true"/></span><span>HanStream</span></Link>
      <div className="site-nav-links"><SlideTabs items={navigation} value={selected} mode="navigation" label="Browse dramas"/></div>
      <div className="site-nav-actions"><div className="site-search"><SearchBar/></div><AuthStatus/><ThemeToggle/></div>
    </nav>
  </header>;
}
