import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const patterns = [/gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{40,}/, /AKIA[A-Z0-9]{16}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const names = /^(?:CACHE_URL|DIAGNOSTICS_TOKEN|.*_SOURCE_URL|POSTER_SEARCH_URLS|TAURI_SIGNING_PRIVATE_KEY|WINDOWS_CERTIFICATE_PASSWORD)$/;
const privateValues = Object.entries(process.env).filter(([key, value]) => names.test(key) && value && value.length >= 12).map(([, value]) => value);
const failures = [];
for (const file of files) {
  if (/(?:^|\/)\.env(?!\.example$)|\.(?:pem|p12|pfx|key)$/.test(file)) { failures.push(file); continue; }
  const raw = await readFile(file).catch(() => null);
  if (!raw || raw.includes(0)) continue;
  const content = raw.toString('utf8');
  if (patterns.some(pattern => pattern.test(content)) || privateValues.some(value => content.includes(value))) failures.push(file);
}
if (failures.length) {
  console.error('Potential private material detected in tracked files:\n' + [...new Set(failures)].join('\n'));
  process.exitCode = 1;
} else console.log(`Checked ${files.length} tracked files for private material.`);
