import { timingSafeEqual } from 'node:crypto';
import { diagnosticSnapshot } from '@/lib/diagnostics';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  const secret = process.env.DIAGNOSTICS_TOKEN;
  const provided = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || secret.length < 32 || Buffer.byteLength(provided) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(diagnosticSnapshot(), { headers: { 'Cache-Control': 'private, no-store' } });
}
