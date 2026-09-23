import { sql, json, bad, readJson, isId, isInt, oneOf, isShort, rateLimit, wrap, SCHOOL } from './_lib/http.mjs';
import { ASSESSMENTS } from '../../src/assessments.js';

const EVENTS = ['baseline_completed', 'attempt_submitted', 'hint_used', 'answer_revised', 'teacher_help_requested', 'stage_completed',
  'reflection_completed', 'apply_started', 'apply_completed', 'feedback_completed', 'safety_stop'];
const STAGES = ['explore', 'think', 'try', 'reflect', 'apply', 'feedback'];
const SAFETY = ['personal_information', 'unsafe_request', 'food_allergen_safety', 'risky_financial_activity', 'safeguarding_disclosure', 'other'];

export default wrap(async req => {
  rateLimit(req, 120);
  const b = await readJson(req, ['sessionId', 'event', 'stage', 'attemptNumber', 'hintLevel', 'score', 'choice', 'aiUsed', 'safetyCategory']);
  if (!isId(b.sessionId)) throw bad('bad sessionId');
  if (!oneOf(b.event, EVENTS)) throw bad('unknown event type');
  if (b.stage !== undefined && !oneOf(b.stage, STAGES)) throw bad('bad stage');
  if (b.attemptNumber !== undefined && !isInt(b.attemptNumber, 1, 50)) throw bad('bad attemptNumber');
  if (b.hintLevel !== undefined && !isInt(b.hintLevel, 0, 7)) throw bad('bad hintLevel');
  if (b.score !== undefined && !isInt(b.score, 0, 100)) throw bad('bad score');
  if (b.choice !== undefined && !isInt(b.choice, 0, 5)) throw bad('bad choice');
  if (b.aiUsed !== undefined && typeof b.aiUsed !== 'boolean') throw bad('bad aiUsed');
  const [sess] = await sql`SELECT id, scenario, class_code, device_label, completed FROM sessions WHERE id = ${b.sessionId}`;
  if (!sess) throw bad('unknown session', 404);
  if (sess.completed) throw bad('session already completed', 409);

  // Baseline / Apply are scored SERVER-SIDE from the chosen option; the browser never supplies the score.
  let score = b.score ?? null;
  if (b.event === 'baseline_completed' || b.event === 'apply_completed') {
    const a = ASSESSMENTS[sess.scenario]?.[b.event === 'baseline_completed' ? 'baseline' : 'apply'];
    if (!a || b.choice === undefined) throw bad('choice required');
    score = b.choice === a.answer ? 100 : 0;
  }
  const aiUsed = b.event === 'apply_completed' ? false : (b.aiUsed ?? null); // Apply is always AI-off

  await sql`INSERT INTO learning_events (session_id, event_type, stage, attempt_number, hint_level, score, ai_used)
            VALUES (${b.sessionId}, ${b.event}, ${b.stage || null}, ${b.attemptNumber ?? null}, ${b.hintLevel ?? null}, ${score}, ${aiUsed})`;
  if (b.stage) await sql`UPDATE sessions SET last_stage = ${b.stage} WHERE id = ${b.sessionId}`;

  if (b.event === 'safety_stop') {
    // SAFEGUARDING: operational record only. No text is accepted or stored. Human review is always required.
    // A genuine concern must go through the school's DSL process — this table is not that process.
    const cat = oneOf(b.safetyCategory, SAFETY) ? b.safetyCategory : 'other';
    await sql`INSERT INTO safety_events (session_id, school_code, class_code, category, human_review_required, device_label)
              VALUES (${b.sessionId}, ${SCHOOL()}, ${sess.class_code}, ${cat}, true, ${sess.device_label})`;
  }
  return json({ ok: true, score });
});
