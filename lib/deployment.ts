import "server-only";
export function webRuntime(env = process.env) {
  return env.VERCEL === "1" || env.HANSTREAM_ROLE === "web";
}
export function readerNamespace(env = process.env) {
  const namespace = env.READER_NAMESPACE || "hanstream";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(namespace))
    throw new Error("Invalid reader namespace.");
  return `hanstream:reader:v1:${namespace}`;
}
