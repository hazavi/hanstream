import "server-only";
import { timingSafeEqual } from "node:crypto";
import { webRuntime, readerNamespace } from "./deployment";
export function bridgeAllowed(request: Request) {
  const token = process.env.READER_GATEWAY_SECRET || "";
  const actual = request.headers.get("authorization") || "";
  const expected = "Bearer " + token;
  return (
    !webRuntime() &&
    token.length >= 32 &&
    token.length <= 128 &&
    Buffer.byteLength(actual) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected)) &&
    request.headers.get("x-reader-namespace") === readerNamespace()
  );
}
