// @vitest-environment node
import { createServer } from 'node:http';
import { Agent, fetch as sourceFetch } from 'undici';
import { expect, it } from 'vitest';

it('keeps the installed dispatcher compatible with Node built-in fetch', async () => {
  const server = createServer((_, response) => { response.writeHead(200, {'Content-Type':'text/html'}); response.end('<html>Published page</html>'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const dispatcher = new Agent({ connections: 1 });
  try {
    const options: RequestInit & { dispatcher: Agent } = { dispatcher, redirect: 'manual', signal: AbortSignal.timeout(5000) };
    const response = await fetch(`http://127.0.0.1:${typeof address === 'object' && address?.port}/`, options);
    expect(response.status).toBe(200); expect(await response.text()).toContain('Published page');
    const source = await sourceFetch(`http://127.0.0.1:${typeof address === 'object' && address?.port}/`, { dispatcher, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    expect(source.status).toBe(200); expect(await source.text()).toContain('Published page');
  } finally {
    await dispatcher.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
