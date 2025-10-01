"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { AuthStatus } from "./AuthStatus";

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

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
        className={`mobile-menu ${
          isOpen ? "open" : ""
        } fixed top-0 left-0 h-full w-65 `}
      >
        <div className="p-3  surface">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary">Menu</span>
            <button
              onClick={closeMenu}
              className="p-2 text-secondary hover:text-primary transition-colors"
              aria-label="Close menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
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
