import { spawnSync } from 'node:child_process';
import { getPagesConfig } from './pages-config.mjs';
import { checkBackend } from './check-backend.mjs';

function git(args, input) {
  const result = spawnSync('git', args, { input, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
  if (result.status !== 0) throw new Error('GitHub sign-in or repository information is unavailable. Sign in with your Git credential manager and retry.');
  return result.stdout.trim();
}

async function connect() {
  const address = process.argv[2];
  if (!address) throw new Error('Usage: npm run connect:backend -- YOUR_RENDER_HTTPS_URL');
  const { api } = getPagesConfig({ NEXT_PUBLIC_API_BASE_URL: address, GITHUB_ACTIONS: 'true' });
  if (!api) throw new Error('Enter the public HTTPS URL shown on your Render service.');
  const remote = git(['remote', 'get-url', 'origin']);
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(remote);
  if (!match) throw new Error('The origin remote must point to this project on github.com.');
  const [, owner, repo] = match;
  const origin = `https://${owner.toLowerCase()}.github.io`;
  console.log('Checking backend health, browser access, and live homepage content. A sleeping service may take a minute to wake.');
  const content = await checkBackend(api, origin);
  console.log(`Backend verified: ${content.recent} recent entries loaded.`);

  // The credential is used only for github.com and remains in process memory.
  const credential = git(['credential', 'fill'], 'protocol=https\nhost=github.com\n\n');
  const fields = Object.fromEntries(credential.split(/\r?\n/).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
  if (!fields.password) throw new Error('No GitHub sign-in is available.');
  const endpoint = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = { Authorization: `Bearer ${fields.password}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'HanStream-deployment-setup' };
  const request = (route, options = {}) => fetch(`${endpoint}${route}`, { ...options, headers, signal: AbortSignal.timeout(30_000) });
  const repository = await request('');
  if (!repository.ok) throw new Error(`GitHub repository access failed (HTTP ${repository.status}).`);
  const { default_branch: branch } = await repository.json();
  const variable = await request('/actions/variables/API_BASE_URL');
  if (![200, 404].includes(variable.status)) throw new Error(`GitHub variable access failed (HTTP ${variable.status}).`);
  const saved = await request(variable.ok ? '/actions/variables/API_BASE_URL' : '/actions/variables', { method: variable.ok ? 'PATCH' : 'POST', body: JSON.stringify({ name: 'API_BASE_URL', value: api }) });
  if (!saved.ok) throw new Error(`Could not update API_BASE_URL (HTTP ${saved.status}).`);
  const started = await request('/actions/workflows/pages.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: branch }) });
  if (!started.ok) throw new Error(`API_BASE_URL was saved, but the Pages workflow could not be started (HTTP ${started.status}). Run it from GitHub Actions.`);
  console.log(`Saved API_BASE_URL and started Deploy GitHub Pages on ${branch}.`);
  console.log(`Follow deployment: https://github.com/${owner}/${repo}/actions/workflows/pages.yml`);
}

connect().catch(error => { console.error(error.message); process.exitCode = 1; });
