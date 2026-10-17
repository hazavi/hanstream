FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY . .
# Non-secret build values let Next collect routes. Actual origins are runtime env only.
RUN BACKEND_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1 \
    STREAM_SOURCE_URL=https://stream.invalid METADATA_SOURCE_URL=https://metadata.invalid \
    EDITORIAL_SOURCE_URL=https://editorial.invalid DETAILS_SOURCE_URL=https://details.invalid npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
