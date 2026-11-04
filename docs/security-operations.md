# Security operations

## Automated checks

`npm run check:secrets` checks tracked files for common credential and private-key formats and for private values present in the process environment. It reports filenames, not matched values. It is a safety check, not a complete secret detector. Enable repository secret scanning where available as another layer.

The security workflow audits all npm dependencies, checks types, runs the regression suite, scans tracked files, and compiles the backend using non-secret placeholder origins. The Pages workflow also audits production dependencies and verifies the final public artifact. Keep dependency patches small and run these checks after updates. The current audit reports zero findings across production and development dependencies.

The lint parser and plugin are pinned to the current ESLint-9-compatible releases. Their nested glob matcher is overridden to the patched minimatch 11 release; targeted lint checks pass. This avoids the old parser version selected by the automatic audit fix. Recheck that override when upgrading the lint toolchain.

The Windows target has a separate RustSec audit of `src-tauri/Cargo.lock` in CI. This scans native dependencies as well as the npm checks for frontend and backend dependencies. RustSec warnings about unmaintained packages need review even when they do not fail the vulnerability check.

## Request limits

API requests have one-minute category budgets. With no verified client identity, requests share limits of 120 search, 180 detail, 600 image, and 300 other catalog requests per minute. Health checks are exempt. Rejections return 429 and `Retry-After`. The map is bounded to 10,000 active entries. With `CACHE_URL` configured, atomic Redis counters share the limits across backend instances; cache failures fall back to process-local counters.

By default, forwarded IP headers are ignored. Set `TRUST_PROXY=1` and `RATE_LIMIT_IP_HEADER` only after verifying that your hosting proxy overwrites that exact header and clients cannot reach the backend around it. Verified clients receive individual budgets of 30 search, 60 detail, 180 image, and 120 other catalog requests per minute. Do not enable this simply because a request contains `X-Forwarded-For`. Without a trusted proxy or shared store, protection is deliberately conservative and shared; this is not a DDoS service.

## Browser and outbound protections

The regular Next server creates a random script nonce per document request, replaces incoming nonce headers, and sends HTML with `private, no-store`. Its theme bootstrap and framework scripts receive that nonce. Production script policy no longer permits arbitrary inline scripts or eval. Inline style permission remains because the current UI uses style attributes and animation. The static frontend keeps its existing per-document script hashes, not request nonces. See [Next.js nonce guidance](https://nextjs.org/docs/app/guides/content-security-policy).

HTML readers and image downloads resolve DNS inside the connecting socket's lookup function and reject answers containing non-public addresses, including mapped IPv4 addresses. Image processing also checks each redirect, allowed origins, byte size, decoded pixel count, and MIME type. No public API accepts an arbitrary upstream image URL.

After a production build, start the local backend and run `node scripts/check-browser-security.mjs`. It checks hydration and the theme button under CSP, then verifies that an unapproved inline script cannot run.

## Diagnostics and incidents

Set backend-only `DIAGNOSTICS_TOKEN` to at least 32 random characters to enable `/api/diagnostics`. Send it in `Authorization: Bearer ...` from an administrative client. Missing or invalid tokens receive 404; responses are never cached. The endpoint returns uptime and aggregate fixed-name counters only. Do not expose this token in the frontend or desktop app.

If a secret leaks: revoke it at the issuing service first, replace it in the backend or CI secret settings, restart or redeploy affected services, invalidate affected cache namespaces, and review access logs. Removing a secret from the latest commit does not remove it from Git history. If a signing key leaks, suspend desktop update publication until trust and key rotation are resolved.

Rotate credentials on a schedule appropriate to the service. Keep logs free of full upstream URLs, tokens, cookies, and profile exports. Redis records expire after one day, rate counters after two minutes, and process caches are bounded. Pages needs a different host or trusted proxy for custom frontend response headers beyond its meta CSP.
