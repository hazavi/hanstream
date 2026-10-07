"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { AuthStatus } from "./AuthStatus";
import { MobileMenu } from "./MobileMenu";
import { TabletMenu } from "./TabletMenu";
import { BrandIcon } from "./BrandIcon";

/**
 * FloatingNav
 * - Appears over content (floating)
 * - Hides when scrolling down, shows when scrolling up
 * - Adds subtle shadow and backdrop blur
 */
export function FloatingNav() {
  const [atTop, setAtTop] = useState(true);
  const pathname = usePathname();

  // Check if we're on an episode page
  const isEpisodePage = pathname.includes("/episode/");

  useEffect(() => {
    const onScroll = () => {
      setAtTop(window.scrollY < 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  return (
    <header
      className={`${
        isEpisodePage ? "sticky" : "fixed"
      } top-0 left-0 right-0 z-50 px-4 pt-3`}
      aria-label="Site navigation"
    >
      <nav
        className={`max-w-7xl mx-auto px-5 h-16 flex items-center justify-between gap-4 transition-all duration-300 rounded-2xl ${
          atTop ? "glass-nav-transparent" : "glass-nav"
        }`}
      >
        <div className="flex items-center gap-4 lg:gap-6 flex-shrink-0">
          <Link href="/" className="flex items-center flex-shrink-0">
            <BrandIcon className="h-10 w-10" />
            <span className="title-text hidden sm:inline ml-2 text-lg font-semibold tracking-tight whitespace-nowrap">
              HanStream
            </span>
          </Link>

          {/* Navigation links */}
          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link
              href="/popular"
              scroll={true}
              className={`nav-link text-sm font-medium transition-all duration-200 relative group ${
                isActive("/popular")
                  ? "nav-active"
                  : ""
              }`}
            >
              Popular
              {isActive("/popular") && (
                <span className="nav-underline absolute -bottom-1 left-0 right-0 h-0.5 rounded-full" />
              )}
              {!isActive("/popular") && (
                <span className="nav-underline absolute -bottom-1 left-0 right-0 h-0.5 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              )}
            </Link>
            <Link
              href="/recent-movies"
              scroll={true}
              className={`nav-link text-sm font-medium transition-all duration-200 relative group ${
                isActive("/recent-movies")
                  ? "nav-active"
                  : ""
              }`}
            >
              Movies
              {isActive("/recent-movies") && (
                <span className="nav-underline absolute -bottom-1 left-0 right-0 h-0.5 rounded-full" />
              )}
              {!isActive("/recent-movies") && (
                <span className="nav-underline absolute -bottom-1 left-0 right-0 h-0.5 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              )}
            </Link>
            <Link
              href="/schedule"
              scroll={true}
              className={`nav-link text-sm font-medium transition-all duration-200 relative group ${
                isActive("/schedule")
                  ? "nav-active"
                  : ""
              }`}
            >
              Schedule
              {isActive("/schedule") && (
                <span className="nav-underline absolute -bottom-1 left-0 right-0 h-0.5 rounded-full" />
              )}
              {!isActive("/schedule") && (
                <span className="nav-underline absolute -bottom-1 left-0 right-0 h-0.5 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
              )}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
          <SearchBar />

          {/* Show AuthStatus/ThemeToggle on larger tablets and desktop (lg+) */}
          <div className="hidden lg:flex items-center gap-2">
            <AuthStatus />
            <ThemeToggle />
          </div>

          {/* Tablet Menu - Shows only on smaller tablets (md to lg) like iPad Air/Mini */}
          <TabletMenu />

          {/* Mobile Menu - Shows on mobile only (below md) with all nav links */}
          <div className="flex items-center md:hidden">
            <MobileMenu />
          </div>
        </div>
      </nav>
    </header>
  );
}
