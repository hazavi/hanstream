import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "../components/ThemeToggle";
import { SearchBar } from "../components/SearchBar";
import { AuthProvider } from "@/lib/auth";
import { ProfileProvider } from "@/lib/profile";
import { AuthStatus } from "@/components/AuthStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HanStream | Asian Drama Streaming",
  description: "Watch Asian dramas online for free.",
  metadataBase: new URL("https://hanstream.local"),
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var store = localStorage.getItem('hanstream-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = store || (prefersDark ? 'dark' : 'dark');
                  if(theme === 'dark') document.documentElement.classList.add('dark');
                  else document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen transition-colors duration-300 bg-neutral-100 dark:bg-neutral-900 text-primary`}
      >
        <div className="flex flex-col min-h-screen relative">
          <AuthProvider>
            <ProfileProvider>
              <header className="sticky top-0 z-50 dark: bg-transparent backdrop-blur-sm ">
                <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                  <div className="flex items-center gap-8">
                    <Link
                      href="/"
                      className="text-2xl font-bold text-gray-500 dark:text-white"
                    >
                      HanStream
                    </Link>

                    {/* Navigation links */}
                    <div className="hidden md:flex items-center gap-6">
                      <Link
                        href="/popular"
                        className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Popular
                      </Link>
                      <Link
                        href="/recent-movies"
                        className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Recent Movies
                      </Link>
                      <Link
                        href="/schedule"
                        className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        Schedule
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <SearchBar />

                    <div className="ml-4">
                      <AuthStatus />
                    </div>

                    <div className="ml-10">
                      <ThemeToggle />
                    </div>
                  </div>
                </nav>
              </header>
              <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
                {children}
              </main>
              <footer className="border-t border-neutral-500/50 py-8">
                <div className="max-w-7xl mx-auto px-6 text-center text-sm text-secondary">
                  HanStream does not store any files on our server, we only
                  linked to the media which is hosted on 3rd party services.
                  <br />
                  &copy; {new Date().getFullYear()} HanStream • All rights
                  reserved.
                </div>
              </footer>
            </ProfileProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
