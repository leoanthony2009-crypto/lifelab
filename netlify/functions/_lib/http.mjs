// Shared helpers for Netlify Functions (v2 API: default export (Request, Context) => Response).
import { neon } from '@netlify/neon';

export const sql = neon(); // reads NETLIFY_DATABASE_URL — never exposed to the client

export const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
export const bad = (msg, status = 400) => json({ error: msg }, status);

const MAX_BODY = 8 * 1024;
export async function readJson(req, allowedKeys) {
  if (req.method !== 'POST') throw bad('POST only', 405);
  const text = await req.text();
  if (text.length > MAX_BODY) throw bad('payload too large', 413);
  let body;
  try { body = JSON.parse(text || '{}'); } catch { throw bad('invalid JSON'); }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw bad('object expected');
  for (const k of Object.keys(body)) if (!allowedKeys.includes(k)) throw bad('unexpected field: ' + k);
  return body;
}

// ---- validators -----------------------------------------------------------
export const isId = v => typeof v === 'string' && /^[a-f0-9]{8}$/.test(v);
export const isCode = v => typeof v === 'string' && /^[A-Z0-9-]{2,12}$/.test(v);
export const isShort = (v, n = 64) => typeof v === 'string' && v.length <= n;
export const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
export const oneOf = (v, arr) => arr.includes(v);
export const clampText = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

// ---- best-effort rate limit (per warm instance) -----------------------------
const buckets = new Map();
export function rateLimit(req, limit = 60, windowMs = 60_000) {
  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'anon';
  const now = Date.now();
  const b = buckets.get(ip) || { n: 0, t: now };
  if (now - b.t > windowMs) { b.n = 0; b.t = now; }
  b.n += 1; buckets.set(ip, b);
  if (buckets.size > 5000) buckets.clear();
  if (b.n > limit) throw bad('too many requests', 429);
}

export const wrap = fn => async (req, ctx) => {
  try { return await fn(req, ctx); }
  catch (e) { if (e instanceof Response) return e; console.error(e); return bad('server error', 500); }
};

export const SCHOOL = () => (process.env.LIFE_LAB_SCHOOL_CODE || 'PILOT').toUpperCase();
export const demoOn = () => String(process.env.LIFE_LAB_DEMO_MODE).toLowerCase() === 'true';
