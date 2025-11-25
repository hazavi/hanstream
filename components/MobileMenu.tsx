"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "./ThemeToggle";
import { AuthStatus } from "./AuthStatus";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    // Close menu when scrolling
    const handleScroll = () => {
      closeMenu();
    };

    // Add event listeners
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll);

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="md:hidden p-2 text-secondary hover:text-primary transition-colors"
        onClick={toggleMenu}
        aria-label="Toggle mobile menu"
      >
        <div
          className={`w-5 h-4 flex flex-col justify-between burger-icon ${
            isOpen ? "burger-open" : ""
          }`}
        >
          <span className="burger-line block h-0.5 w-full bg-current"></span>
          <span className="burger-line block h-0.5 w-full bg-current"></span>
          <span className="burger-line block h-0.5 w-full bg-current"></span>
        </div>
      </button>

      {/* Mobile Navigation Overlay */}
      {isOpen && (
        <div className="mobile-nav-overlay active" onClick={closeMenu}></div>
      )}

      {/* Mobile Navigation Menu */}
      <div
        ref={menuRef}
        className={`mobile-menu ${
          isOpen ? "open" : ""
        } fixed top-0 left-0 h-full w-80`}
      >
        <div className="p-3 surface">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">Menu</span>
            <button
              onClick={closeMenu}
              className="p-2 text-secondary hover:text-primary transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close menu"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="p-4 space-y-4 surface flex-1">
          <Link
            href="/"
            className="block py-2 text-secondary hover:text-primary transition-colors"
            onClick={closeMenu}
          >
            Home
          </Link>
          <Link
            href="/popular"
            className="block py-2 text-secondary hover:text-primary transition-colors"
            onClick={closeMenu}
          >
            Popular
          </Link>
          <Link
            href="/recently-added"
            className="block py-2 text-secondary hover:text-primary transition-colors"
            onClick={closeMenu}
          >
            Recently Added
          </Link>
          <Link
            href="/recent-movies"
            className="block py-2 text-secondary hover:text-primary transition-colors"
            onClick={closeMenu}
          >
            Recent Movies
          </Link>
          <Link
            href="/schedule"
            className="block py-2 text-secondary hover:text-primary transition-colors"
            onClick={closeMenu}
          >
            Schedule
          </Link>
          <Link
            href="/watch2gether"
            className="flex items-center gap-2 py-2 text-secondary hover:text-primary transition-colors"
            onClick={closeMenu}
          >
            <Image
              src="/stream.png"
              alt=""
              width={20}
              height={20}
              className="rounded"
            />
            Watch2gether
          </Link>
        </nav>

        {/* Profile and Settings Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t surface">
          <div className="space-y-4">
            {/* User Profile Section */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <AuthStatus />
              </div>
              <div className="flex-shrink-0">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body scroll lock when menu is open */}
      {isOpen && (
        <style jsx global>{`
          body {
            overflow: hidden;
          }
        `}</style>
      )}
    </>
  );
}
