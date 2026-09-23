import { sql, json, bad, rateLimit, wrap, requireTeacher, SCHOOL, demoOn } from './_lib/http.mjs';
// Aggregates the six evidence areas. Class-level only — no per-pupil rows, no ranking, no risk scoring.
const MODULES = ['MoneyWise', 'CookSmart', 'Digital Life', 'Enterprise'];
export default wrap(async req => {
  rateLimit(req, 60);
  await requireTeacher(req);
  const u = new URL(req.url);
  const f = k => u.searchParams.get(k) || null;
  const module = MODULES.includes(f('module')) ? f('module') : null;
  const scenario = /^[a-z0-9_]{1,40}$/.test(f('scenario') || '') ? f('scenario') : null;
  const ks = /^KS[1-4]$/.test(f('ks') || '') ? f('ks') : null;
  const cls = /^[A-Z0-9-]{1,12}$/.test(f('class') || '') ? f('class') : null;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(f('from') || '') ? f('from') : '2000-01-01';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(f('to') || '') ? f('to') : '2100-01-01';
  const schools = demoOn() ? [SCHOOL(), 'DEMO'] : [SCHOOL()];

  const rows = await sql`
    SELECT s.id, s.module, s.scenario, s.key_stage, s.class_code, s.completed, s.last_stage, s.duration_s, s.school_code,
           o.baseline_score, o.apply_score, o.learning_gain, o.highest_hint, o.teacher_intervention, o.completed_without_ai, o.independence_band, o.attempts_before_hint, o.attempt_count,
           p.thinking_rating, p.independence_rating, p.helpfulness_rating, p.use_again
    FROM sessions s LEFT JOIN outcomes o ON o.session_id = s.id LEFT JOIN pupil_feedback p ON p.session_id = s.id
    WHERE s.school_code = ANY(${schools}) AND s.started_at >= ${from}::date AND s.started_at < (${to}::date + interval '1 day')
      AND (${module}::text IS NULL OR s.module = ${module}) AND (${scenario}::text IS NULL OR s.scenario = ${scenario})
      AND (${ks}::text IS NULL OR s.key_stage = ${ks}) AND (${cls}::text IS NULL OR s.class_code = ${cls})`;
  const teacher = await sql`SELECT teacher_prep_band, teacher_help_band, teacher_workload_rating FROM teacher_sessions
    WHERE school_code = ANY(${schools}) AND session_date >= ${from}::date AND session_date <= ${to}::date
      AND (${module}::text IS NULL OR module = ${module}) AND (${cls}::text IS NULL OR class_code = ${cls})`;
  const safety = await sql`SELECT review_status, count(*)::int AS n FROM safety_events
    WHERE school_code = ANY(${schools}) AND created_at >= ${from}::date AND created_at < (${to}::date + interval '1 day')
      AND (${cls}::text IS NULL OR class_code = ${cls}) GROUP BY review_status`;
  const classes = await sql`SELECT DISTINCT class_code FROM sessions WHERE school_code = ANY(${schools}) ORDER BY 1`;

  const n = rows.length, done = rows.filter(r => r.completed);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const avg = (arr, k) => { const v = arr.map(r => r[k]).filter(x => x != null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
  const count = (arr, fn) => arr.filter(fn).length;
  const dropouts = {}; rows.filter(r => !r.completed).forEach(r => { dropouts[r.last_stage] = (dropouts[r.last_stage] || 0) + 1; });
  const dropoutStage = Object.entries(dropouts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const hintDist = [0, 1, 2, 3, 4, 5, 6, 7].map(h => count(done, r => (r.highest_hint ?? 0) === h));
  const bands = { independent: count(done, r => r.independence_band === 'independent'), scaffolded: count(done, r => r.independence_band === 'scaffolded'), significant_scaffold: count(done, r => r.independence_band === 'significant_scaffold') };
  const fb = done.filter(r => r.thinking_rating != null);
  const dist = (k, max) => Array.from({ length: max }, (_, i) => count(fb, r => r[k] === i + 1));
  const band = (k, vals) => vals.map(v => count(teacher, t => t[k] === v));
  const safetyN = s => safety.find(x => x.review_status === s)?.n || 0;

  return json({
    demo: rows.some(r => r.school_code === 'DEMO'),
    filters: { classes: classes.map(c => c.class_code), modules: MODULES },
    engagement: { started: n, completed: done.length, completionRate: pct(done.length, n), avgDurationMin: done.length ? Math.round(avg(done, 'duration_s') / 60) : null, dropoutStage, dropouts },
    learning: { baselinePct: avg(done, 'baseline_score'), applyPct: avg(done, 'apply_score'), avgGain: avg(done, 'learning_gain'), improvedPct: pct(count(done, r => (r.learning_gain ?? 0) > 0), count(done, r => r.learning_gain != null)) },
    independence: { completedIndependently: count(done, r => r.independence_band === 'independent'), completedTotal: done.length, avgHighestHint: avg(done, 'highest_hint'), teacherInterventionPct: pct(count(done, r => r.teacher_intervention), done.length), completedWithoutAiPct: pct(count(done, r => r.completed_without_ai), done.length), attemptFirstPct: pct(count(done, r => (r.attempts_before_hint ?? 0) >= 1), done.length), hintDist, bands },
    feedback: { responses: fb.length, thinking: dist('thinking_rating', 4), independence: dist('independence_rating', 4), helpfulness: dist('helpfulness_rating', 4), useAgain: dist('use_again', 3), helpfulPct: pct(count(fb, r => r.helpfulness_rating >= 3), fb.length), useAgainPct: pct(count(fb, r => r.use_again === 3), fb.length) },
    workload: { checkouts: teacher.length, prep: band('teacher_prep_band', ['0-5', '6-10', '11-20', '20+']), help: band('teacher_help_band', ['none', 'few', 'some', 'many']), rating: [1, 2, 3, 4, 5].map(v => count(teacher, t => t.teacher_workload_rating === v)), avgRating: avg(teacher, 'teacher_workload_rating') },
    safety: { stops: safetyN('outstanding') + safetyN('reviewed'), reviewed: safetyN('reviewed'), outstanding: safetyN('outstanding') },
  });
});
