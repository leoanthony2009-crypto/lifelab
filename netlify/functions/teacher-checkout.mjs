import { sql, json, bad, readJson, isCode, oneOf, isInt, isShort, rateLimit, wrap, SCHOOL } from './_lib/http.mjs';
export default wrap(async req => {
  rateLimit(req, 30);
  const b = await readJson(req, ['classCode', 'module', 'scenario', 'prepBand', 'helpBand', 'workloadRating']);
  if (!isCode(b.classCode)) throw bad('bad classCode');
  if (!oneOf(b.module, ['MoneyWise', 'CookSmart', 'Digital Life', 'Enterprise'])) throw bad('bad module');
  if (b.scenario !== undefined && !isShort(b.scenario, 40)) throw bad('bad scenario');
  if (!oneOf(b.prepBand, ['0-5', '6-10', '11-20', '20+'])) throw bad('bad prepBand');
  if (!oneOf(b.helpBand, ['none', 'few', 'some', 'many'])) throw bad('bad helpBand');
  if (!isInt(b.workloadRating, 1, 5)) throw bad('bad workloadRating');
  await sql`INSERT INTO teacher_sessions (school_code, class_code, module, scenario, teacher_prep_band, teacher_help_band, teacher_workload_rating)
            VALUES (${SCHOOL()}, ${b.classCode}, ${b.module}, ${b.scenario || null}, ${b.prepBand}, ${b.helpBand}, ${b.workloadRating})`;
  return json({ ok: true });
});
