import React, { useEffect, useState } from 'react';
import { teacherFetch } from '../api.js';
import { SCENARIOS, MODULES } from '../scenarios.js';

// Teacher Evidence Dashboard — six areas, class level only. No per-pupil rows, no ranking, no risk scores.
// No sign-in: everything shown here is aggregate and anonymous by design.
export default function Teacher() { return <Dashboard />; }

const Bars = ({ labels, values, accent }) => { const max = Math.max(1, ...values); return <div className="bars" role="list">{labels.map((l, i) => <div className="bar" role="listitem" key={l}><span>{l}</span><i style={{ width: `${(values[i] / max) * 100}%`, background: accent }} aria-hidden="true" /><span aria-label={`${l}: ${values[i]}`}>{values[i]}</span></div>)}</div>; };
const fmt = (v, suf = '') => (v == null ? '—' : v + suf);
const modal = (labels, counts) => labels[counts.indexOf(Math.max(...counts))];
const Card = ({ title, big, sub, accent }) => <div className="card col kpi-card" style={{ gap: 6, paddingLeft: 20, '--accent': accent || 'var(--money)' }}><div className="eyebrow">{title}</div><div className="kpi" style={{ color: accent }}>{big}</div><div className="small muted">{sub}</div></div>;
const Chart = ({ title, children }) => <div className="card col" style={{ gap: 12 }}><h3 style={{ fontSize: 16 }}>{title}</h3>{children}</div>;

function Dashboard() {
  const [f, setF] = useState({ module: '', scenario: '', ks: '', class: '', from: '', to: '' });
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [tab, setTab] = useState('overview');
  const loadSummary = () => { const qs = new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v))); setErr(''); teacherFetch('/api/teacher/summary?' + qs).then(setD).catch(e => setErr(e.message)); };
  useEffect(loadSummary, [JSON.stringify(f)]);
  const scenarios = SCENARIOS.filter(s => !f.module || (s.mode === f.module || f.module === 'Enterprise' && /juice|wraps/.test(s.id) || f.module === 'Digital Life' && s.id === 'mw_coins'));
  const set = k => e => setF({ ...f, [k]: e.target.value, ...(k === 'module' ? { scenario: '' } : {}) });
  return (
    <main className="wrap wide">
      <header className="row between">
        <div className="row"><img src="/icons/icon-192.png" alt="" width="40" height="40" style={{ borderRadius: 12 }} /><div><div className="eyebrow">Future Skills Life Lab</div><h1 style={{ fontSize: 28 }}>Class Overview</h1></div></div>
        <a href="/" className="btn ghost small">← Pupil lab</a>
      </header>
      {d?.demo && <div className="banner" role="status">Demonstration data — not real pupils. Set LIFE_LAB_DEMO_MODE=false before the school pilot.</div>}
      <nav className="tabs" aria-label="Sections">{[['overview', 'Evidence'], ['checkout', 'Check-out'], ['safety', 'Safety review']].map(([k, l]) => <button type="button" key={k} className="tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>
      {tab === 'overview' && <>
        <div className="card filters" role="group" aria-label="Filters">
          <label>Module<select value={f.module} onChange={set('module')}><option value="">All</option>{MODULES.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>Scenario<select value={f.scenario} onChange={set('scenario')}><option value="">All</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
          <label>Key stage<select value={f.ks} onChange={set('ks')}><option value="">All</option>{['KS1', 'KS2', 'KS3', 'KS4'].map(k => <option key={k}>{k}</option>)}</select></label>
          <label>Class<select value={f.class} onChange={set('class')}><option value="">All</option>{(d?.filters.classes || []).map(c => <option key={c}>{c}</option>)}</select></label>
          <label>From<input type="date" value={f.from} onChange={set('from')} /></label>
          <label>To<input type="date" value={f.to} onChange={set('to')} /></label>
        </div>
        {err && <div className="warn" role="alert">{err} — check the database is connected (Netlify DB) and migrated.</div>}
        {!d && !err && <p className="muted">Loading class evidence…</p>}
        {d && d.engagement.started === 0 && <div className="card empty"><strong>No sessions yet for this selection.</strong><br /><span className="small">Evidence appears here as soon as pupils start a level with a class code.</span></div>}
        {d && d.engagement.started > 0 && <>
          <section className="grid" aria-label="Headline evidence">
            <Card title="Sessions" big={`${d.engagement.completed}/${d.engagement.started}`} sub={`${fmt(d.engagement.completionRate, '%')} completion`} />
            <Card title="Learning" big={fmt(d.learning.avgGain != null ? (d.learning.avgGain > 0 ? '+' : '') + Math.round(d.learning.avgGain) : null, ' pts')} sub={`Baseline ${fmt(d.learning.baselinePct && Math.round(d.learning.baselinePct), '%')} → Apply ${fmt(d.learning.applyPct && Math.round(d.learning.applyPct), '%')} · ${fmt(d.learning.improvedPct, '%')} improved`} />
            <Card title="Independence" big={`${d.independence.completedIndependently}/${d.independence.completedTotal}`} sub={`completed Apply independently · avg highest hint ${fmt(d.independence.avgHighestHint)} · ${fmt(d.independence.teacherInterventionPct, '%')} needed teacher help`} />
            <Card title="Engagement" big={fmt(d.engagement.avgDurationMin, ' min')} sub={`average session · most common drop-out: ${d.engagement.dropoutStage || 'none'}`} />
            <Card title="Pupil experience" big={fmt(d.feedback.helpfulPct, '%')} sub={`found the support helpful · ${fmt(d.feedback.useAgainPct, '%')} would do another · ${d.feedback.responses} responses`} />
            <Card title="Teacher workload" big={d.workload.checkouts ? modal(['0–5 min', '6–10 min', '11–20 min', '20+ min'], d.workload.prep) : '—'} sub={`typical prep · direct support: ${d.workload.checkouts ? modal(['none', 'few', 'some', 'many'], d.workload.help) : '—'} · ${d.workload.checkouts} check-outs`} />
            <Card title="Safety" big={String(d.safety.stops)} sub={`safety stops · ${d.safety.reviewed} reviewed · ${d.safety.outstanding} outstanding`} accent={d.safety.outstanding ? '#C24E2A' : undefined} />
          </section>
          <section className="grid" aria-label="Charts">
            <Chart title="Learning · baseline vs Apply"><Bars labels={['Baseline %', 'Apply %']} values={[Math.round(d.learning.baselinePct || 0), Math.round(d.learning.applyPct || 0)]} /></Chart>
            <Chart title="Independence · highest hint level"><Bars labels={['0', '1', '2', '3', '4', '5', '6', '7'].map(h => 'Hint ' + h)} values={d.independence.hintDist} /><div className="small muted">{d.independence.bands.independent} independent · {d.independence.bands.scaffolded} scaffolded · {d.independence.bands.significant_scaffold} significant scaffold. Programme-level categories, not pupil labels.</div></Chart>
            <Chart title="Engagement · started vs completed"><Bars labels={['Started', 'Completed']} values={[d.engagement.started, d.engagement.completed]} /></Chart>
            <Chart title="Pupil feedback"><Bars labels={['Think: not much', 'a little', 'quite a lot', 'a lot']} values={d.feedback.thinking} /><Bars labels={['Help: not', 'a little', 'helpful', 'very']} values={d.feedback.helpfulness} accent="#C24E2A" /><Bars labels={['Again: no', 'maybe', 'yes']} values={d.feedback.useAgain} accent="#6B665C" /></Chart>
            <Chart title="Teacher workload"><Bars labels={['Prep 0–5', '6–10', '11–20', '20+']} values={d.workload.prep} /><Bars labels={['Help: none', 'few', 'some', 'many']} values={d.workload.help} accent="#C24E2A" /><Bars labels={['Much more', 'More', 'Same', 'Less', 'Much less']} values={d.workload.rating} accent="#6B665C" /></Chart>
            <Chart title="Safety · events → reviewed → outstanding"><Bars labels={['Events', 'Reviewed', 'Outstanding']} values={[d.safety.stops, d.safety.reviewed, d.safety.outstanding]} accent="#C24E2A" /><div className="small muted">Operational counts only. A genuine concern follows the school's DSL process, not this dashboard.</div></Chart>
          </section>
        </>}
      </>}
      {tab === 'checkout' && <Checkout classes={d?.filters.classes || []} onDone={loadSummary} />}
      {tab === 'safety' && <Safety onChange={loadSummary} />}
    </main>);
}

function Checkout({ classes, onDone }) {
  const [v, setV] = useState({ classCode: classes[0] || '', module: 'MoneyWise', scenario: '', prepBand: '6-10', helpBand: 'few', workloadRating: 3 }); const [msg, setMsg] = useState('');
  const Seg = ({ k, opts }) => <div className="row">{opts.map(([val, l]) => <button type="button" key={val} className={'btn small ' + (v[k] === val ? '' : 'ghost')} aria-pressed={v[k] === val} onClick={() => setV({ ...v, [k]: val })}>{l}</button>)}</div>;
  return (
    <form className="card col" style={{ maxWidth: 640, gap: 14 }} onSubmit={e => { e.preventDefault(); teacherFetch('/api/teacher/checkout', { method: 'POST', body: JSON.stringify({ ...v, classCode: v.classCode.toUpperCase(), scenario: v.scenario || undefined }) }).then(() => { setMsg('Saved — thank you. About 10 seconds well spent.'); onDone(); }).catch(e => setMsg(e.message)); }}>
      <div><h2 style={{ fontSize: 22 }}>Teacher check-out</h2><p className="muted small">Three taps after a lesson. Class-level only.</p></div>
      <div className="row"><label style={{ flex: 1 }}>Class code<input value={v.classCode} onChange={e => setV({ ...v, classCode: e.target.value.toUpperCase() })} required pattern="[A-Z0-9-]{2,12}" placeholder="OAK-14" /></label><label style={{ flex: 1 }}>Module<select value={v.module} onChange={e => setV({ ...v, module: e.target.value })}>{MODULES.map(m => <option key={m}>{m}</option>)}</select></label></div>
      <div className="col"><strong>Preparation required</strong><Seg k="prepBand" opts={[['0-5', '0–5 min'], ['6-10', '6–10 min'], ['11-20', '11–20 min'], ['20+', '20+ min']]} /></div>
      <div className="col"><strong>How many pupils needed direct teacher help?</strong><Seg k="helpBand" opts={[['none', 'None'], ['few', 'Few'], ['some', 'Some'], ['many', 'Many']]} /></div>
      <div className="col"><strong>Compared with teaching a similar activity normally</strong><Seg k="workloadRating" opts={[[1, 'Much more work'], [2, 'More work'], [3, 'About the same'], [4, 'Less work'], [5, 'Much less work']]} /></div>
      <button className="btn" type="submit">Save check-out</button>{msg && <div className="small" role="status">{msg}</div>}
    </form>);
}

function Safety({ onChange }) {
  const [rows, setRows] = useState([]); const [err, setErr] = useState('');
  const refresh = () => teacherFetch('/api/safety/review').then(r => setRows(r.events)).catch(e => setErr(e.message));
  useEffect(() => { refresh(); }, []);
  return (
    <section className="card col" style={{ gap: 14 }}>
      <div><h2 style={{ fontSize: 22 }}>Safety review</h2>
        <p className="muted small">Operational log only: when a stop happened, on which device, and whether a member of staff has followed it up. No pupil text exists here. Marking an event reviewed records that the school's own safeguarding procedure was followed — it is not the procedure.</p></div>
      {err && <div className="warn">{err}</div>}
      <div className="tablewrap"><table><thead><tr><th>When</th><th>Class</th><th>Device</th><th>Category</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td>{new Date(r.created_at).toLocaleString('en-GB')}</td><td>{r.class_code}</td><td>{r.device_label || '—'}</td><td>{r.category.replace(/_/g, ' ')}</td><td style={{ color: r.review_status === 'outstanding' ? '#C24E2A' : undefined, fontWeight: 600 }}>{r.review_status}</td><td>{r.review_status === 'outstanding' && <button type="button" className="btn small" onClick={() => teacherFetch('/api/safety/review', { method: 'POST', body: JSON.stringify({ id: r.id }) }).then(() => { refresh(); onChange(); })}>Mark reviewed</button>}</td></tr>)}
        {!rows.length && <tr><td colSpan={6} className="empty">No safety events.</td></tr>}
      </tbody></table></div>
    </section>);
}
