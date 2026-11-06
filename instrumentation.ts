export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.VERCEL !== "1" &&
    process.env.HANSTREAM_ROLE !== "web" &&
    process.env.READER_GATEWAY_SECRET &&
    process.env.CACHE_URL
  ) {
    const { startConfiguredReader } = await import("@reader/runtime");
    await startConfiguredReader();
  }
}
