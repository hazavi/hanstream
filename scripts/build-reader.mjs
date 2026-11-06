import { build } from "esbuild";
export const workerPlugin = {
  name: "worker-server-boundary",
  setup(builder) {
    builder.onResolve({ filter: /^server-only$/ }, () => ({
      path: "empty",
      namespace: "worker-empty",
    }));
    builder.onLoad({ filter: /.*/, namespace: "worker-empty" }, () => ({
      contents: "",
    }));
    builder.onResolve({ filter: /^next\/server$/ }, () => ({
      path: "server",
      namespace: "worker-next",
    }));
    builder.onLoad({ filter: /.*/, namespace: "worker-next" }, () => ({
      contents:
        "export const NextResponse=Response; export function after(task){void Promise.resolve().then(task).catch(()=>{});}",
    }));
    builder.onResolve({filter:/^next\/cache$/},()=>({path:'cache',namespace:'worker-cache'}));
    builder.onLoad({filter:/.*/,namespace:'worker-cache'},()=>({contents:'export function unstable_cache(fn){return fn;}'}));
  },
};
if (process.argv[1]?.endsWith("build-reader.mjs"))
  await build({
    entryPoints: ["worker/main.ts"],
    outfile: "reader-out/worker.mjs",
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    packages: "external",
    plugins: [workerPlugin],
  });
console.log("Built the separate source-reader worker.");
