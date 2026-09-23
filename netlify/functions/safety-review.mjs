import { sql, json, bad, readJson, isInt, rateLimit, wrap, SCHOOL, demoOn } from './_lib/http.mjs';
// Operational review only: which stops are outstanding, mark as reviewed. No disclosure content exists to show.
// Reviewing here does NOT replace the school's DSL process.
export default wrap(async req => {
  rateLimit(req, 60);
  const schools = demoOn() ? [SCHOOL(), 'DEMO'] : [SCHOOL()];
  if (req.method === 'GET') {
    const rows = await sql`SELECT id, session_id, class_code, category, review_status, device_label, created_at, reviewed_at
                           FROM safety_events WHERE school_code = ANY(${schools}) ORDER BY review_status DESC, created_at DESC LIMIT 200`;
    return json({ events: rows });
  }
  const b = await readJson(req, ['id']);
  if (!isInt(b.id, 1, 1e12)) throw bad('bad id');
  await sql`UPDATE safety_events SET review_status = 'reviewed', reviewed_at = now() WHERE id = ${b.id} AND school_code = ANY(${schools})`;
  return json({ ok: true });
});
