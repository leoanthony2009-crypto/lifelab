// Client API — sends structured events only. Free text never leaves the device except the optional 200-char
// reflection and coach turns (which pass the deterministic gate first, client- and server-side).
const QUEUE_KEY = 'lifelab.eventQueue';
const readQ = () => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } };
const writeQ = q => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200))); } catch {} };

async function post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}
export const startSession = body => post('/api/session/start', body);
export const completeSession = body => post('/api/session/complete', body);
export const coach = body => post('/api/coach', body).catch(() => null);
// Events are fire-and-forget; if offline they queue and replay (anonymous learning events only — never safety text).
export async function sendEvent(body) {
  try { return await post('/api/session/event', body); }
  catch (e) { if (!navigator.onLine) { writeQ([...readQ(), body]); return null; } throw e; }
}
export async function flushQueue() {
  const q = readQ(); if (!q.length) return;
  writeQ([]);
  for (const body of q) { try { await post('/api/session/event', body); } catch { writeQ([...readQ(), body]); } }
}
window.addEventListener('online', flushQueue);

// Teacher calls carry the Identity token; functions verify it and the role server-side.
export function teacherFetch(path, opts = {}) {
  const user = window.netlifyIdentity?.currentUser();
  if (!user) return Promise.reject(new Error('sign in required'));
  return user.jwt().then(token => fetch(path, { ...opts, headers: { ...(opts.headers || {}), authorization: 'Bearer ' + token, 'content-type': 'application/json' } }))
    .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r.json(); });
}
