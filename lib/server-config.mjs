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
  const catalogOrigin = env.CATALOG_SOURCE_URL?.trim() ? origin(env, 'CATALOG_SOURCE_URL') : undefined;
  const mediaOrigin = env.MEDIA_SOURCE_URL?.trim() ? origin(env, 'MEDIA_SOURCE_URL') : undefined;
  const artworkOrigin = env.ARTWORK_SOURCE_URL?.trim() ? origin(env, 'ARTWORK_SOURCE_URL') : undefined;
  const referenceOrigin = env.REFERENCE_SOURCE_URL?.trim() ? origin(env, 'REFERENCE_SOURCE_URL') : undefined;
  const posterSearchUrls=(env.POSTER_SEARCH_URLS||'').split(',').map(value=>value.trim()).filter(Boolean);
  for(const template of posterSearchUrls){try{const url=new URL(template.replaceAll('{query}','test'));if(!template.includes('{query}')||url.protocol!=='https:'||url.username||url.password||url.port)throw new Error();}catch{throw new Error('Invalid HTTPS search template in POSTER_SEARCH_URLS');}}
  // Editorial pages publish canonical links without www, while the homepage uses www.
  const editorialCanonical = new URL(editorialOrigin);
  editorialCanonical.hostname = editorialCanonical.hostname.replace(/^www\./, '');
  const editorialOrigins = [...new Set([editorialOrigin, editorialCanonical.origin])];
  return {
    streamOrigin, metadataOrigin, editorialOrigin, editorialCanonicalOrigin: editorialCanonical.origin, detailsOrigin, catalogOrigin, mediaOrigin, artworkOrigin, referenceOrigin,posterSearchUrls,
    editorialOrigins,
    allowedOrigins: [...new Set([streamOrigin, metadataOrigin, detailsOrigin, ...editorialOrigins, catalogOrigin, mediaOrigin, artworkOrigin, referenceOrigin,...posterSearchUrls.map(value=>new URL(value.replaceAll('{query}','test')).origin)].filter(Boolean))],
  };
}

export function isSourceRedirect(from, to) {
  const config = getSourceConfig();
  return from.origin === to.origin || (config.editorialOrigins.includes(from.origin) && config.editorialOrigins.includes(to.origin));
}
