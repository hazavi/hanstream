import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import "./load-env.mjs";

function run(args, env = process.env) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status || 1);
}
const shield = Boolean(
  process.env.PLAYER_ORIGINS || process.env.DESKTOP_MEDIA_ORIGINS,
);
if (shield) run(["scripts/build-player-shield.mjs"]);
else rmSync("public/downloads/hanstream-player-shield.zip", { force: true });
run(["node_modules/next/dist/bin/next", "build"], {
  ...process.env,
  HANSTREAM_ROLE: "web",
  NEXT_PUBLIC_API_BASE_URL: "",
  NEXT_PUBLIC_PLAYER_SHIELD: shield ? "1" : "0",
});
