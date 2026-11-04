// @vitest-environment node
import { expect, it } from 'vitest';
import { desktopConfig } from '../scripts/desktop-config.mjs';
it('packages only a public HTTPS API origin and enables no native commands by default', () => {
  const {api,signed,config} = desktopConfig({DESKTOP_API_BASE_URL:'https://backend.example'});
  expect(api).toBe('https://backend.example'); expect(signed).toBe(false);
  expect(config.app.security.capabilities).toEqual(['main']);
  expect(config.app.security.csp).toContain('ipc: http://ipc.localhost');
  expect(config.bundle.createUpdaterArtifacts).toBe(false);
  expect(() => desktopConfig({DESKTOP_API_BASE_URL:'http://localhost:3000'})).toThrow();
});
it('fails closed when signed updates are requested without signing material', () => {
  expect(() => desktopConfig({DESKTOP_API_BASE_URL:'https://backend.example',DESKTOP_SIGNED_UPDATES:'1'})).toThrow('signing key');
});
