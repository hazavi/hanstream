import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getPagesConfig } from "./pages-config.mjs";
import { securePages } from './secure-pages.mjs';

const root = process.cwd();
const desktop = process.env.HANSTREAM_DESKTOP === '1';
const stage = path.join(root, desktop ? '.desktop-build' : '.pages-build');
const output = path.join(root, desktop ? 'desktop-out' : 'out');
const { api, basePath } = getPagesConfig();
if (!api) console.warn("Backend URL is not set. Publishing the frontend with a connection notice; set the repository variable API_BASE_URL and rebuild to enable live listings and playback.");
for (const target of [stage, output]) {
  if (path.dirname(path.resolve(target)) !== path.resolve(root)) throw new Error("Build directory is outside the workspace.");
  await rm(target, { recursive: true, force: true });
}
await mkdir(path.join(stage, "app"), { recursive: true });
await mkdir(path.join(stage, "lib"));
await mkdir(path.join(stage, "components"));
await cp(path.join(root, "public"), path.join(stage, "public"), { recursive: true });
const adapt = text => text.replace(/from (["'])next\/link\1/g, 'from "@/lib/site-link"').replace(/from (["'])next\/navigation\1/g, 'from "@/lib/site-navigation"').replace(/from (["'])next\/image\1/g, 'from "@/lib/site-image"').replaceAll('from "@/lib/api"', 'from "@/lib/api-types"').replaceAll('from "../lib/api"', 'from "../lib/api-types"').replaceAll('pathname.includes("/episode/")', 'pathname.includes("/watch")');
const excluded = new Set(["Pagination.tsx", "VideoPlayer.tsx"]);
for (const name of await readdir(path.join(root, "components"))) {
  if (!name.endsWith(".tsx") || excluded.has(name)) continue;
  await writeFile(path.join(stage, "components", name), adapt(await readFile(path.join(root, "components", name), "utf8")));
}
await cp(path.join(root,"components/ui"),path.join(stage,"components/ui"),{recursive:true});
for (const name of await readdir(path.join(stage, 'components/ui'))) {
  if (name.endsWith('.tsx')) await writeFile(path.join(stage,'components/ui',name),adapt(await readFile(path.join(stage,'components/ui',name),'utf8')));
}
for (const name of ["native.ts", "client-cache.ts", "profile-storage.ts", "detail-cache.ts", "artwork-cache.ts", "embed.ts", "utils.ts", "image-utils.mjs", "api-types.ts", "catalog.ts", "format.ts", "profile.tsx", "profile-transfer.ts", "request-validation.ts", "types.ts", "pages-client.ts", "pages-routes.ts"]) await cp(path.join(root, "lib", name), path.join(stage, "lib", name));
await writeFile(path.join(stage, "lib/api-client.ts"), 'export { fetchSearchClient } from "./pages-client";\n');
await writeFile(path.join(stage, "lib/site-link.tsx"), `"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { pagesRoute } from "./pages-routes";
export default function SiteLink({ href, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} href={typeof href === "string" ? pagesRoute(href) : href} />;
}
`);
await writeFile(path.join(stage, 'lib/site-navigation.ts'), `"use client";
import {useRouter as useNextRouter} from "next/navigation";
import {useMemo} from "react";
import {pagesRoute} from "./pages-routes";
export {usePathname,useSearchParams} from "next/navigation";
export function useRouter() {
  const router=useNextRouter();
  return useMemo(()=>({...router,push:(href:string,options?:Parameters<typeof router.push>[1])=>router.push(pagesRoute(href),options),replace:(href:string,options?:Parameters<typeof router.replace>[1])=>router.replace(pagesRoute(href),options),prefetch:(href:string,options?:Parameters<typeof router.prefetch>[1])=>router.prefetch(pagesRoute(href),options)}),[router]);
}
`);
await writeFile(path.join(stage, "lib/site-image.tsx"), `"use client";
import Image, { type ImageProps } from "next/image";
export default function SiteImage({ src, ...props }: ImageProps) {
  return <Image {...props} src={typeof src === "string" && src.startsWith("/") && !src.startsWith("//") ? ${JSON.stringify(basePath)} + src : src} />;
}
`);
await cp(path.join(root, "app/globals.css"), path.join(stage, "app/globals.css"));
await cp(path.join(root, "app/outline.css"), path.join(stage, "app/outline.css"));
const layout = adapt(await readFile(path.join(root, "app/layout.tsx"), "utf8"))
  .replace('import { headers } from "next/headers";', '')
  .replace('export default async function RootLayout', 'export default function RootLayout')
  .replace("const nonce = (await headers()).get('x-nonce') || undefined;", 'const nonce = undefined;')
  .replace('icon: "/favicon.ico"', `icon: ${JSON.stringify(`${basePath}/favicon.ico`)}`)
  .replace('metadataBase: new URL("https://hanstream.site"),', "");
await writeFile(path.join(stage, "app/layout.tsx"), layout);
for (const route of ["home", "popular", "recently-added", "recent-movies", "search", "drama", "watch", "profile"]) {
  const directory = route === "home" ? path.join(stage, "app") : path.join(stage, "app", route);
  await mkdir(directory, { recursive: true });
  const content = route === "profile" ? adapt(await readFile(path.join(root, "app/profile/page.tsx"), "utf8")) : `import { Suspense } from "react";
import PagesApp from "@/components/PagesApp";
import {PageSkeleton} from "@/components/PageSkeleton";
export default function Page() { return <Suspense fallback={<PageSkeleton view="${route}" />}><PagesApp view="${route}" /></Suspense>; }
`;
  await writeFile(path.join(directory, "page.tsx"), content);
  await writeFile(path.join(directory, 'loading.tsx'), `import {PageSkeleton} from "@/components/PageSkeleton"; export default function Loading(){return <PageSkeleton view="${route}"/>;}`);
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
await securePages(output, api, desktop);
await writeFile(path.join(output, ".nojekyll"), "");
console.log(`Frontend files are ready in ${desktop ? 'desktop-out/' : 'out/'} (base path: ${basePath || "/"}).`);
