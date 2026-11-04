import './load-env.mjs';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { desktopConfig } from './desktop-config.mjs';

const mode = process.argv[2] || 'build';
if (!['dev', 'build', 'web'].includes(mode)) throw new Error('Expected desktop mode: dev, build, or web.');
const { api, signed, config } = desktopConfig();
await writeFile('src-tauri/tauri.generated.conf.json', JSON.stringify(config, null, 2));
const env = { ...process.env, HANSTREAM_DESKTOP: '1', NEXT_PUBLIC_API_BASE_URL: api, NEXT_PUBLIC_DESKTOP_UPDATES: signed ? '1' : '0', PAGES_BASE_PATH: '' };
const localCargo = path.resolve('.tools/cargo');
if (existsSync(path.join(localCargo, 'bin/cargo.exe'))) {
  env.CARGO_HOME = localCargo; env.RUSTUP_HOME = path.resolve('.tools/rustup'); env.PATH = `${path.join(localCargo, 'bin')}${path.delimiter}${env.PATH}`;
}
const extra = process.argv.slice(3);
const args = mode === 'web' ? ['scripts/build-pages.mjs'] : ['node_modules/@tauri-apps/cli/tauri.js', mode, '--config', path.resolve('src-tauri/tauri.generated.conf.json'), ...(signed ? ['--features', 'signed-updates'] : []), ...extra.filter(value => value !== '--locked'), ...(extra.includes('--locked') ? ['--', '--locked'] : [])];
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
process.exit(result.status || (result.error ? 1 : 0));
