// Shared by the server readers and Node maintenance scripts. Never import into client code.
function origin(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing server environment variable: ${name}`);
  try {
    const address = new URL(value);
    if (address.protocol !== 'https:' || address.username || address.password || address.port || address.pathname !== '/' || address.search || address.hash) throw new Error();
    return address.origin;
  } catch {
    // Do not include the configured value in errors or logs.
    throw new Error(`Invalid HTTPS origin in server environment variable: ${name}`);
  }
}

/** @param {Record<string, string | undefined>} env */
export function getSourceConfig(env = process.env) {
  if (typeof window !== 'undefined') throw new Error('Source configuration is server-only.');
  const streamOrigin = origin(env, 'STREAM_SOURCE_URL');
  const metadataOrigin = origin(env, 'METADATA_SOURCE_URL');
  const editorialOrigin = origin(env, 'EDITORIAL_SOURCE_URL');
  const detailsOrigin = origin(env, 'DETAILS_SOURCE_URL');
  // Editorial pages publish canonical links without www, while the homepage uses www.
  const editorialCanonical = new URL(editorialOrigin);
  editorialCanonical.hostname = editorialCanonical.hostname.replace(/^www\./, '');
  const editorialOrigins = [...new Set([editorialOrigin, editorialCanonical.origin])];
  return {
    streamOrigin, metadataOrigin, editorialOrigin, editorialCanonicalOrigin: editorialCanonical.origin, detailsOrigin,
    editorialOrigins,
    allowedOrigins: [...new Set([streamOrigin, metadataOrigin, detailsOrigin, ...editorialOrigins])],
  };
}

export function isSourceRedirect(from, to) {
  const config = getSourceConfig();
  return from.origin === to.origin || (config.editorialOrigins.includes(from.origin) && config.editorialOrigins.includes(to.origin));
}
