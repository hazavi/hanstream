import "./globals.css";
import "./outline.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ProfileProvider } from "@/lib/profile";
import { FloatingNav } from "@/components/FloatingNav";
import { ScrollToTop } from "@/components/ScrollToTop";
import { DynamicMain } from "@/components/DynamicMain";
import { ToastViewport } from '@/components/ui/toast';

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HanStream | Asian Drama Streaming",
  description: "Watch Asian dramas online for free.",
  metadataBase: new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined) || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'),
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') || undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var store = localStorage.getItem('hanstream-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var theme = store || 'dark';
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
        className={`site-shell ${geistSans.variable} ${geistMono.variable} antialiased min-h-screen text-primary`}
      >
          <div className="flex flex-col min-h-screen relative">
              <ProfileProvider>
                <FloatingNav />
                <ScrollToTop />
                <ToastViewport />
                <DynamicMain>{children}</DynamicMain>
                <footer className="border-t border-neutral-500/50 py-8">
                  <div className="max-w-7xl mx-auto px-6 text-center text-sm text-secondary">
                    &copy; {new Date().getFullYear()} HanStream • All rights
                    reserved.
                    <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed">
                      The site and app do not host video files on their servers. All content is provided by non-affiliated third parties.
                    </p>
                  </div>
                </footer>
              </ProfileProvider>
          </div>
      </body>
    </html>
  );
}
