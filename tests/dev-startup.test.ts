// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { acquireDevLock } from '../scripts/dev.mjs';

const directories: string[] = [];
async function lockPath() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'hanstream-dev-test-'));
  directories.push(directory);
  return path.join(directory, '.hanstream-dev.lock');
}
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map(directory => {
    const target = path.resolve(directory);
    if (path.dirname(target) !== path.resolve(os.tmpdir()) || !path.basename(target).startsWith('hanstream-dev-test-')) throw new Error('Unexpected temporary test directory');
    return rm(target, {recursive:true,force:true});
  }));
});

it('rejects a second launcher until the first releases its development cache lock', async () => {
  const file = await lockPath();
  const release = await acquireDevLock(file);
  await expect(acquireDevLock(file)).rejects.toThrow('already running');
  await release();
  const releaseAgain = await acquireDevLock(file);
  await releaseAgain();
});

it('recovers a lock only after its owning launcher has exited', async () => {
  const file = await lockPath();
  await writeFile(file, JSON.stringify({pid:12345678,token:'stale'}));
  vi.spyOn(process, 'kill').mockImplementation(() => { throw Object.assign(new Error('not running'), {code:'ESRCH'}); });
  const release = await acquireDevLock(file);
  expect(JSON.parse(await readFile(file, 'utf8')).pid).toBe(process.pid);
  await release();
});

it('does not remove an incomplete lock held by a launcher that is still starting', async () => {
  const file = await lockPath();
  await writeFile(file, '');
  await expect(acquireDevLock(file)).rejects.toThrow('already running');
  expect(await readFile(file, 'utf8')).toBe('');
});
