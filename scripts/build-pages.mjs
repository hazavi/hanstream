import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const stage = path.join(root, ".pages-build");
const output = path.join(root, "out");
const api = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
if (!api) throw new Error("Set NEXT_PUBLIC_API_BASE_URL to your deployed backend URL before building Pages.");
const url = new URL(api);
if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !(url.protocol === "https:" || !process.env.GITHUB_ACTIONS && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("The backend URL must be an HTTPS origin (localhost HTTP is allowed for local preview).");
const basePath = (process.env.PAGES_BASE_PATH || "").replace(/\/$/, "");
if (basePath && !/^\/[a-zA-Z0-9._-]+$/.test(basePath)) throw new Error("PAGES_BASE_PATH must be empty or one repository path, such as /hanstream.");
for (const target of [stage, output]) {
  if (path.dirname(path.resolve(target)) !== path.resolve(root)) throw new Error("Build directory is outside the workspace.");
  await rm(target, { recursive: true, force: true });
}
await mkdir(path.join(stage, "app"), { recursive: true });
await mkdir(path.join(stage, "lib"));
await mkdir(path.join(stage, "components"));
await cp(path.join(root, "public"), path.join(stage, "public"), { recursive: true });
const adapt = text => text.replaceAll('from "next/link"', 'from "@/lib/site-link"').replaceAll('from "next/image"', 'from "@/lib/site-image"').replaceAll('from "@/lib/api"', 'from "@/lib/api-types"').replaceAll('from "../lib/api"', 'from "../lib/api-types"').replaceAll('pathname.includes("/episode/")', 'pathname.includes("/watch")');
const excluded = new Set(["HeroSection.tsx", "Pagination.tsx", "VideoPlayer.tsx"]);
for (const name of await readdir(path.join(root, "components"))) {
  if (!name.endsWith(".tsx") || excluded.has(name)) continue;
  await writeFile(path.join(stage, "components", name), adapt(await readFile(path.join(root, "components", name), "utf8")));
}
for (const name of ["api-types.ts", "catalog.ts", "format.ts", "profile.tsx", "types.ts", "pages-client.ts", "pages-routes.ts"]) await cp(path.join(root, "lib", name), path.join(stage, "lib", name));
await writeFile(path.join(stage, "lib/api-client.ts"), 'export { fetchSearchClient } from "./pages-client";\n');
await writeFile(path.join(stage, "lib/site-link.tsx"), `"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { pagesRoute } from "./pages-routes";
export default function SiteLink({ href, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} href={typeof href === "string" ? pagesRoute(href) : href} />;
}
`);
await writeFile(path.join(stage, "lib/site-image.tsx"), `"use client";
import Image, { type ImageProps } from "next/image";
export default function SiteImage({ src, ...props }: ImageProps) {
  return <Image {...props} src={typeof src === "string" && src.startsWith("/") && !src.startsWith("//") ? ${JSON.stringify(basePath)} + src : src} />;
}
`);
await cp(path.join(root, "app/globals.css"), path.join(stage, "app/globals.css"));
const layout = adapt(await readFile(path.join(root, "app/layout.tsx"), "utf8"))
  .replace('icon: "/favicon.ico"', `icon: ${JSON.stringify(`${basePath}/favicon.ico`)}`)
  .replace('metadataBase: new URL("https://hanstream.site"),', "");
await writeFile(path.join(stage, "app/layout.tsx"), layout);
for (const route of ["home", "popular", "recently-added", "recent-movies", "search", "schedule", "drama", "watch", "profile"]) {
  const directory = route === "home" ? path.join(stage, "app") : path.join(stage, "app", route);
  await mkdir(directory, { recursive: true });
  const content = route === "profile" ? adapt(await readFile(path.join(root, "app/profile/page.tsx"), "utf8")) : `import { Suspense } from "react";
import PagesApp from "@/components/PagesApp";
export default function Page() { return <Suspense fallback={<p role="status">Loading dramas...</p>}><PagesApp view="${route}" /></Suspense>; }
`;
  await writeFile(path.join(directory, "page.tsx"), content);
}
await cp(path.join(root, "postcss.config.mjs"), path.join(stage, "postcss.config.mjs"));
await writeFile(path.join(stage, "package.json"), JSON.stringify({ name: "hanstream-pages", private: true, dependencies: { next: "*", react: "*", "react-dom": "*" } }));
const tsconfig = JSON.parse(await readFile(path.join(root, "tsconfig.json"), "utf8"));
tsconfig.exclude = ["node_modules"];
await writeFile(path.join(stage, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
// This project contains no source readers, catalogs, API routes, or private environment files.
await writeFile(path.join(stage, "next.config.mjs"), `export default { output: "export", trailingSlash: true, basePath: ${JSON.stringify(basePath)}, images: { unoptimized: true }, eslint: { ignoreDuringBuilds: true }, env: { NEXT_PUBLIC_API_BASE_URL: ${JSON.stringify(api)} }, experimental: { cpus: 2 } };\n`);
const result = spawnSync(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "build", stage], { cwd: root, stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: api, NEXT_TELEMETRY_DISABLED: "1" } });
if (result.status !== 0) process.exit(result.status || 1);
await cp(path.join(stage, "out"), output, { recursive: true });
await writeFile(path.join(output, ".nojekyll"), "");
console.log(`Pages files are ready in out/ (base path: ${basePath || "/"}).`);
