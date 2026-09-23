import { randomBytes } from 'node:crypto';
import { sql, json, bad, readJson, isCode, oneOf, isShort, rateLimit, wrap, SCHOOL } from './_lib/http.mjs';
import { SCENARIOS, MODULE_OF } from '../../src/scenarios.js';

export default wrap(async req => {
  rateLimit(req, 30);
  const b = await readJson(req, ['classCode', 'scenarioId', 'deviceLabel']);
  if (!isCode(b.classCode)) throw bad('bad classCode');
  const s = SCENARIOS.find(x => x.id === b.scenarioId);
  if (!s) throw bad('unknown scenario');
  if (b.deviceLabel !== undefined && !isShort(b.deviceLabel, 24)) throw bad('bad deviceLabel');
  const id = randomBytes(4).toString('hex'); // server-generated pseudonymous id
  await sql`INSERT INTO sessions (id, school_code, class_code, key_stage, module, scenario, device_label)
            VALUES (${id}, ${SCHOOL()}, ${b.classCode}, ${s.stage}, ${MODULE_OF(s)}, ${s.id}, ${b.deviceLabel || null})`;
  await sql`INSERT INTO learning_events (session_id, event_type, stage) VALUES (${id}, 'session_started', 'explore')`;
  return json({ sessionId: id });
});
