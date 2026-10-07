// @ts-ignore -- Next.js handles global CSS imports at build time.
import "./globals.css";
import type { Metadata } from "next";
import { ProfileProvider } from "@/lib/profile";
import { FloatingNav } from "@/components/FloatingNav";
import { ScrollToTop } from "@/components/ScrollToTop";
import { DynamicMain } from "@/components/DynamicMain";

export const metadata: Metadata = {
  title: "HanStream | Asian Drama Streaming",
  description: "Watch Asian dramas online for free.",
  metadataBase: new URL("https://hanstream.site"),
  icons: {
    icon: "/soft-icon.svg",
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
                  var theme = store || (prefersDark ? 'dark' : 'light');
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
        className="antialiased min-h-screen transition-colors duration-300 bg-neutral-100 dark:bg-neutral-900 text-primary overflow-x-hidden"
      >
          <div className="flex flex-col min-h-screen relative overflow-x-hidden">
              <ProfileProvider>
                <FloatingNav />
                <ScrollToTop />
                <DynamicMain>{children}</DynamicMain>
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
          </div>
      </body>
    </html>
  );
}
