import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
async function walk(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await walk(file)));
    else result.push(file);
  }
  return result;
}
const files = await walk(".next/server/app");
for (const file of files.filter((file) => file.endsWith(".nft.json"))) {
  const trace = JSON.parse(await readFile(file, "utf8"));
  assert.ok(
    !trace.files.some((item) =>
      /node_modules\/(?:cheerio|undici|sharp)\/|lib\/source-/.test(
        item.replaceAll("\\", "/"),
      ),
    ),
    "A source reader dependency entered the Vercel trace: " + file,
  );
}
const chunks = (await walk(".next/server/chunks")).filter((file) =>
  file.endsWith(".js"),
);
const code = (
  await Promise.all(chunks.map((file) => readFile(file, "utf8")))
).join("\n");
assert.ok(
  code.includes("Source readers are not included in the website deployment."),
  "Missing Vercel source-reader boundary",
);
assert.ok(
  !code.includes("Invalid source URL"),
  "HTML reader entered the Vercel server bundle",
);
console.log("Vercel source-reader boundary passed.");
