import crypto from 'crypto';
import { cookies } from 'next/headers';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const USING_DEFAULT_PASSWORD = !process.env.ADMIN_PASSWORD;
const COOKIE = 'pg_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;

// The cookie signing key comes from SESSION_SECRET, or else is derived from the Blob token, so every
// serverless instance agrees on it. With neither set (local trial only) each run makes its own.
let cachedSecret = null;
function secret() {
  if (cachedSecret) return cachedSecret;
  const base = process.env.SESSION_SECRET || (Object.entries(process.env).find(([k, v]) => /_READ_WRITE_TOKEN$/.test(k) && v) || [])[1] || crypto.randomBytes(32).toString('hex');
  return (cachedSecret = crypto.createHash('sha256').update('ats-session|' + base).digest('hex'));
}
const sign = (v) => crypto.createHmac('sha256', secret()).update(v).digest('hex');
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function passwordOk(pw) {
  return safeEqual(sign('pw|' + pw), sign('pw|' + ADMIN_PASSWORD));
}

export async function startSession(secure = false) {
  const exp = String(Date.now() + SESSION_MS);
  (await cookies()).set(COOKIE, exp + '.' + sign('admin|' + exp), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MS / 1000,
    secure: process.env.COOKIE_SECURE === '1' || (secure && process.env.COOKIE_SECURE !== '0'),
  });
}
export async function endSession() {
  (await cookies()).set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
export async function isAdmin() {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return false;
  const [exp, mac] = t.split('.');
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  return safeEqual(mac, sign('admin|' + exp));
}

/** For API routes: returns a Response when the request must be refused, otherwise null. */
export async function guard(request) {
  const origin = request.headers.get('origin');
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* invalid */ }
    const mine = [request.headers.get('host'), request.headers.get('x-forwarded-host')].filter(Boolean);
    if (!mine.includes(host)) return Response.json({ error: 'Request blocked.' }, { status: 403 });
  }
  if (!(await isAdmin())) return Response.json({ error: 'Please log in as admin.' }, { status: 401 });
  return null;
}

const attempts = new Map();
export function loginBlocked(ip) {
  const a = attempts.get(ip);
  return !!a && a.reset > Date.now() && a.n >= 10;
}
export function noteLoginFailure(ip) {
  const a = attempts.get(ip);
  if (!a || a.reset < Date.now()) attempts.set(ip, { n: 1, reset: Date.now() + 15 * 60 * 1000 });
  else a.n += 1;
}
