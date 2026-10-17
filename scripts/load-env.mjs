import nextEnv from '@next/env';

// Match Next.js .env.local/.env loading without printing configuration values.
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', {
  info() {},
  error() { console.error('Could not load local environment configuration.'); },
});
