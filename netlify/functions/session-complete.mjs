import { sql, json, bad, readJson, isId, isInt, rateLimit, wrap } from './_lib/http.mjs';
import { gateText } from '../../src/safety.js';

// Computes outcomes from the server-side event log; the browser only supplies feedback ratings and a
// short optional reflection (gate-checked, capped at 200 chars, never sent to the model).
export default wrap(async req => {
  rateLimit(req, 30);
  const b = await readJson(req, ['sessionId', 'thinking', 'independence', 'helpfulness', 'useAgain', 'reflection', 'teacherIntervention']);
  if (!isId(b.sessionId)) throw bad('bad sessionId');
  for (const k of ['thinking', 'independence', 'helpfulness']) if (b[k] !== undefined && !isInt(b[k], 1, 4)) throw bad('bad ' + k);
  if (b.useAgain !== undefined && !isInt(b.useAgain, 1, 3)) throw bad('bad useAgain');
  if (b.teacherIntervention !== undefined && typeof b.teacherIntervention !== 'boolean') throw bad('bad teacherIntervention');
  let reflection = typeof b.reflection === 'string' ? b.reflection.trim().slice(0, 200) : '';
  if (reflection && gateText(reflection).blocked) reflection = ''; // never persist personal data or disclosures

  const [sess] = await sql`SELECT id, started_at, completed FROM sessions WHERE id = ${b.sessionId}`;
  if (!sess) throw bad('unknown session', 404);
  if (sess.completed) throw bad('already completed', 409);
  const ev = await sql`SELECT event_type, attempt_number, hint_level, score, ai_used, created_at FROM learning_events WHERE session_id = ${b.sessionId} ORDER BY created_at`;

  const last = t => [...ev].reverse().find(e => e.event_type === t);
  const baseline = last('baseline_completed')?.score ?? null;
  const apply = last('apply_completed')?.score ?? null;
  const attempts = ev.filter(e => e.event_type === 'attempt_submitted');
  const taskScore = attempts.length ? Math.max(...attempts.map(e => e.score ?? 0)) : null;
  const hints = ev.filter(e => e.event_type === 'hint_used');
  const highest = hints.length ? Math.max(...hints.map(e => e.hint_level ?? 0)) : 0;
  const firstHintAt = hints[0]?.created_at;
  const beforeHint = firstHintAt ? attempts.filter(e => e.created_at < firstHintAt).length : attempts.length;
  const revisions = ev.filter(e => e.event_type === 'answer_revised').length;
  const teacherHelp = (b.teacherIntervention ?? false) || ev.some(e => e.event_type === 'teacher_help_requested');
  const aiShown = ev.some(e => e.ai_used === true);
  const band = teacherHelp || highest >= 5 ? 'significant_scaffold' : highest >= 3 ? 'scaffolded' : 'independent';
  const gain = baseline != null && apply != null ? apply - baseline : null;
  const duration = Math.max(0, Math.round((Date.now() - new Date(sess.started_at).getTime()) / 1000));

  await sql`INSERT INTO outcomes (session_id, baseline_score, task_score, apply_score, learning_gain, attempt_count, attempts_before_hint, highest_hint, answer_revision_count, teacher_intervention, completed_without_ai, independence_band)
            VALUES (${b.sessionId}, ${baseline}, ${taskScore}, ${apply}, ${gain}, ${attempts.length}, ${beforeHint}, ${highest}, ${revisions}, ${teacherHelp}, ${!aiShown}, ${band})
            ON CONFLICT (session_id) DO UPDATE SET baseline_score = EXCLUDED.baseline_score, task_score = EXCLUDED.task_score, apply_score = EXCLUDED.apply_score, learning_gain = EXCLUDED.learning_gain, attempt_count = EXCLUDED.attempt_count, attempts_before_hint = EXCLUDED.attempts_before_hint, highest_hint = EXCLUDED.highest_hint, answer_revision_count = EXCLUDED.answer_revision_count, teacher_intervention = EXCLUDED.teacher_intervention, completed_without_ai = EXCLUDED.completed_without_ai, independence_band = EXCLUDED.independence_band, updated_at = now()`;
  if (b.thinking) await sql`INSERT INTO pupil_feedback (session_id, thinking_rating, independence_rating, helpfulness_rating, use_again, optional_learning_reflection)
            VALUES (${b.sessionId}, ${b.thinking}, ${b.independence ?? null}, ${b.helpfulness ?? null}, ${b.useAgain ?? null}, ${reflection || null}) ON CONFLICT (session_id) DO NOTHING`;
  await sql`INSERT INTO learning_events (session_id, event_type, stage) VALUES (${b.sessionId}, 'session_completed', 'feedback')`;
  await sql`UPDATE sessions SET completed = true, completed_at = now(), last_stage = 'complete', duration_s = ${duration} WHERE id = ${b.sessionId}`;
  return json({ ok: true, outcome: { baseline, apply, gain, highest, band, completedWithoutAi: !aiShown } });
});
