import { passwordOk, startSession, endSession, loginBlocked, noteLoginFailure } from '@/lib/auth';
import { fail, safe } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(request) {
  return safe(async () => {
    const ip = (request.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    if (loginBlocked(ip)) return fail('Too many tries. Please wait a few minutes.', 429);
    const b = await request.json().catch(() => ({}));
    if (!passwordOk(String(b.password || ''))) { noteLoginFailure(ip); return fail('Wrong password.', 401); }
    const https = (request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '')) === 'https';
    await startSession(https);
    return Response.json({ ok: true });
  });
}

export async function DELETE() {
  await endSession();
  return Response.json({ ok: true });
}
