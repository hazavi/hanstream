// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
const dns = vi.hoisted(() => ({ lookup: vi.fn(), connect: undefined as unknown as { lookup: (host: string, options: {all?:boolean}, callback: (...args: unknown[]) => void) => void } }));
vi.mock('node:dns/promises', () => ({ lookup: dns.lookup }));
vi.mock('undici', () => ({ Agent: class { constructor(options: {connect: typeof dns.connect}) { dns.connect = options.connect; } } }));
import '../lib/outbound';
afterEach(() => dns.lookup.mockReset());
it.each([[{address:'127.0.0.1',family:4}], [{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]])('blocks DNS answers containing any non-public address', async (...records) => {
  dns.lookup.mockResolvedValue(records);
  const error = await new Promise(resolve => dns.connect.lookup('images.example', {all:true}, (...args) => resolve(args[0])));
  expect(error).toBeInstanceOf(Error);
});
it('passes the verified DNS answer directly to the connecting socket', async () => {
  const records = [{address:'8.8.8.8',family:4}]; dns.lookup.mockResolvedValue(records);
  const args = await new Promise(resolve => dns.connect.lookup('images.example', {all:true}, (...args) => resolve(args)));
  expect(args).toEqual([null, records]);
});
