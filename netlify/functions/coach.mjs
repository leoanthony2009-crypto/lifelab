// Server-side Azure OpenAI coaching layer. The app runs the lesson; the model may only re-word an approved
// hint (levels 1-4), ask one question or give brief feedback. Any failure → the teacher-authored hint.
// Explore (baseline) and Apply never reach this function: the client has no AI affordance on those stages,
// and the stage policy below rejects them anyway.
import { json, bad, readJson, isId, isInt, oneOf, rateLimit, wrap, sql } from './_lib/http.mjs';
import { SCENARIOS } from '../../src/scenarios.js';
import { gateText, filterModelOutput } from '../../src/safety.js';

const MODE = (process.env.LIFE_LAB_AI_MODE || 'off').toLowerCase();
const POLICY = { think: 'question', try_feedback: 'feedback', try_hint: 'hint', reflect: 'reflection_followup' };
const MAX_AI_HINT = 4;
const SYSTEM = `You are the coaching layer inside "Future Skills Life Lab", a teacher-supervised classroom tool for pupils aged 5-11 in England. You are a neutral learning tool, not a friend or person. The application runs the lesson: you receive the approved scenario, the stage, the permitted hint level and its exact pre-written text. You may only: ask ONE short question (stage think/try), re-word the permitted hint (levels 1-4 only) so it connects to what the pupil wrote, give brief specific feedback with ONE follow-up question, or turn a reflection into ONE follow-up question. Never give the final answer or any number that appears only in higher hints. Never introduce new topics, prices, websites. Never ask for or repeat personal information; if present set flag personal_info_present and ignore it. If the text shows distress or danger respond ONLY with response_type "refuse", next_action "stop", flag distress_language. No advice about the pupil's own family money or health. British English, £ and p, max 60 words, no emoji, no lists; very short simple sentences for Y1-Y2. Return only the JSON object.`;
const SCHEMA = { type: 'object', additionalProperties: false, required: ['response_type', 'hint_level', 'message', 'next_action', 'flags'], properties: {
  response_type: { type: 'string', enum: ['question', 'hint', 'feedback', 'reflection_followup', 'refuse'] }, hint_level: { type: 'integer' }, message: { type: 'string' },
  next_action: { type: 'string', enum: ['pupil_attempt', 'open_hint', 'pupil_reflect', 'pupil_apply', 'stop'] }, flags: { type: 'array', items: { type: 'string', enum: ['off_topic', 'personal_info_present', 'distress_language', 'asked_for_answer'] } } } };

let client = null;
async function getClient() {
  if (client || MODE === 'off') return client;
  const { AZURE_OPENAI_ENDPOINT: ep, AZURE_OPENAI_API_KEY: key } = process.env;
  if (!ep || !key) return null;
  const { default: OpenAI } = await import('openai');
  client = new OpenAI({ baseURL: ep.replace(/\/$/, '') + '/openai/v1', apiKey: key, timeout: 8000, maxRetries: 1 });
  return client;
}

export default wrap(async req => {
  rateLimit(req, 40);
  const b = await readJson(req, ['sessionId', 'scenarioId', 'stage', 'permittedLevel', 'pupilText', 'attemptNumber']);
  if (!isId(b.sessionId)) throw bad('bad sessionId');
  const s = SCENARIOS.find(x => x.id === b.scenarioId);
  if (!s) throw bad('unknown scenario');
  if (!oneOf(b.stage, Object.keys(POLICY))) throw bad('stage does not permit AI');
  if (!isInt(b.permittedLevel, 0, 7)) throw bad('bad level');
  const text = typeof b.pupilText === 'string' ? b.pupilText.slice(0, 600) : '';
  const fallback = b.stage === 'try_hint' ? s.hints[b.permittedLevel - 1] || '' : b.stage === 'think' ? s.think : b.stage === 'reflect' ? 'Thank you. One more thought: what would you tell a friend who was stuck on this?' : 'Well done for having a go. Before you open a hint, ask yourself: how do I know? Could I count it, check it or explain it to a friend?';

  // Deterministic gate first — nothing personal or distressing ever reaches the model.
  const gate = gateText(text);
  if (gate.blocked) return json({ text: fallback, source: 'off', blocked: gate.reason });
  if (s.aiAllowed === false || (b.stage === 'try_hint' && (b.permittedLevel > MAX_AI_HINT || b.permittedLevel < 1))) return json({ text: fallback, source: 'off' });
  const c = await getClient();
  if (!c) return json({ text: fallback, source: 'off' });

  const payload = { scenario_id: s.id, mode: s.mode, year_group: s.year, stage: b.stage.split('_')[0], expected_response_type: POLICY[b.stage], learning_focus: s.focus, scenario_brief: s.brief, think_prompt: s.think, permitted_hint_level: b.permittedLevel, permitted_hint_text: b.stage === 'try_hint' ? s.hints[b.permittedLevel - 1] : '', attempt_number: b.attemptNumber ?? 0, pupil_text: text };
  let parsed = null, note = 'ok';
  try {
    const r = await c.responses.create({ model: process.env.AZURE_OPENAI_DEPLOYMENT, instructions: SYSTEM, input: JSON.stringify(payload), store: false, max_output_tokens: 220,
      text: { format: { type: 'json_schema', name: 'life_lab_coach_turn', strict: true, schema: SCHEMA } } });
    parsed = JSON.parse(r.output_text || 'null');
  } catch (e) { note = /content_filter/i.test(String(e)) ? 'azure_content_filter' : 'error'; }
  const { message, reason } = filterModelOutput(parsed, POLICY[b.stage], b.permittedLevel, s);
  const shown = message && MODE === 'on';
  try { await sql`INSERT INTO learning_events (session_id, event_type, stage, hint_level, ai_used) VALUES (${b.sessionId}, 'stage_completed', ${'ai_' + b.stage}, ${b.permittedLevel}, ${!!shown})`; } catch {}
  return json({ text: shown ? message : fallback, source: shown ? 'ai' : 'fallback', audit: { note, filter: reason } });
});
