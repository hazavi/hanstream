import { open, readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function isRunning(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== 'ESRCH'; }
}

/** Next 15 does not prevent two dev servers from replacing the same generated chunks. */
export async function acquireDevLock(file) {
  const token = randomUUID();
  const busy = () => new Error('A HanStream development server is already running or starting. Stop it before running npm run dev again.');
  let handle;
  try { handle = await open(file, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let previous;
    try { previous = JSON.parse(await readFile(file, 'utf8')); }
    catch { throw busy(); }
    if (!Number.isSafeInteger(previous.pid) || previous.pid < 1 || isRunning(previous.pid)) throw busy();
    // Recover a lock left by a terminated launcher; never stop another process.
    await unlink(file);
    try { handle = await open(file, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw busy(); throw error; }
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, token })); }
  finally { await handle.close(); }
  return async () => {
    try {
      if (JSON.parse(await readFile(file, 'utf8')).token === token) await unlink(file);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const release = await acquireDevLock(path.join(root, '.hanstream-dev.lock'));
  try {
    const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    try {
      process.exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => resolve(code ?? 0));
      });
    } finally {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
    }
  } finally { await release(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
