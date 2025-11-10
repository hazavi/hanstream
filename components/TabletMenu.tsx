"use client";

import { useState, useEffect, useRef } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { AuthStatus } from "./AuthStatus";

export function TabletMenu() {
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
      {/* Tablet Menu Button - Only for smaller tablets (iPad Air/Mini), not iPad Pro */}
      <button
        className="hidden md:block lg:hidden p-2 text-secondary hover:text-primary transition-colors"
        onClick={toggleMenu}
        aria-label="Toggle settings menu"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Tablet Navigation Overlay */}
      {isOpen && (
        <div className="mobile-nav-overlay active" onClick={closeMenu}></div>
      )}

      {/* Tablet Navigation Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed top-0 right-0 h-auto w-64 animate-slide-in-right"
          style={{ zIndex: 9999 }}
        >
          <div className="p-4 surface shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-bold text-primary">Settings</span>
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

            {/* Settings Section */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="w-full">
                  <AuthStatus />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
