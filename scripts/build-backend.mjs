import { spawnSync } from "node:child_process";
import path from "node:path";
const result = spawnSync(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "build"], { stdio: "inherit", env: { ...process.env, BACKEND_STANDALONE: "1" } });
process.exit(result.status || (result.error ? 1 : 0));
