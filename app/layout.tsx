import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle } from "../components/ThemeToggle";
import { SearchBar } from "../components/SearchBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HanStream | Korean Drama Streaming",
  description: "Watch recently added & popular Korean dramas. Simple, clean, fast UI.",
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen transition-colors duration-300 bg-neutral-100 dark:bg-neutral-900 text-primary`}> 
        {/* Flat background (removed gradient overlay) */}
        <div className="flex flex-col min-h-screen relative">
          <header className="sticky top-0 z-50 dark: bg-transparent backdrop-blur-3xl backdrop-saturate-200 shadow-black/5 dark:shadow-black/30">
            <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <Link href="/" className="text-2xl font-bold text-gray-500 dark:text-white">
                HanStream
              </Link>
              <div className="flex items-center gap-1">
                <SearchBar />

                <div className="ml-2">
                  <ThemeToggle />
                </div>
              </div>
            </nav>
          </header>
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">
            <div className="animate-fade-in">
              {children}
            </div>
          </main>
          <footer className="border-t border-neutral-100 dark:border-neutral-800 py-8">
            <div className="max-w-7xl mx-auto px-6 text-center text-sm text-secondary">
              HanStream does not store any files on our server, we only linked to the media which is hosted on 3rd party services.
              <br />
              &copy; {new Date().getFullYear()} HanStream • All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
