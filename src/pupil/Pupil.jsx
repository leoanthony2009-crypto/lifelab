import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SCENARIOS, MODULES, MODULE_OF, THEME, HINT_LABELS, SKILLS } from '../scenarios.js';
import { ASSESSMENTS } from '../assessments.js';
import { gateText } from '../safety.js';
import { startSession, sendEvent, completeSession, coach, flushQueue } from '../api.js';

const LIMIT_MIN = 20;
const store = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const speak = t => { if (!window.speechSynthesis) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'en-GB'; u.rate = 0.95; speechSynthesis.speak(u); };
const hits = (text, s) => Math.min(100, Math.round((s.lookFor.filter(k => text.toLowerCase().includes(k)).length / 3) * 100));
const Listen = ({ text, small }) => <button type="button" className={'btn ghost' + (small ? ' small' : '')} aria-label="Listen" onClick={() => speak(text)}>▶ Listen</button>;
const Steps = ({ at }) => <ol className="steps" aria-label="Progress">{['Explore', 'Think', 'Try', 'Reflect', 'Apply'].map((l, i) => <li key={l} className={'step' + (i <= at ? ' on' : '') + (i === at ? ' now' : '')} aria-current={i === at ? 'step' : undefined}><i aria-hidden="true" />{l}</li>)}</ol>;
const Choices = ({ options, value, onChange, multi }) => (
  <div className="col" role="group">{options.map((o, i) => { const on = multi ? value.includes(i) : value === i; return (
    <button type="button" key={o} className={'choice' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onChange(multi ? (on ? value.filter(v => v !== i) : [...value, i]) : i)}><span className="dot" aria-hidden="true" />{o}</button>); })}</div>);

export default function Pupil() {
  const [classCode, setClassCode] = useState(() => load('lifelab.classCode', ''));
  const [device, setDevice] = useState(() => load('lifelab.device', ''));
  const [passport, setPassport] = useState(() => load('lifelab.passport.' + load('lifelab.classCode', ''), {}));
  const [view, setView] = useState('home'); // home | journey | session
  const [module, setModule] = useState(null);
  const [scenario, setScenario] = useState(null);
  useEffect(() => { flushQueue(); }, []);
  useEffect(() => { store('lifelab.classCode', classCode); setPassport(load('lifelab.passport.' + classCode, {})); }, [classCode]);
  useEffect(() => { store('lifelab.device', device); }, [device]);
  const stamp = (id, extra) => setPassport(p => { const n = { ...p, [id]: { ...(p[id] || {}), done: true, ...extra } }; store('lifelab.passport.' + classCode, n); return n; });

  if (view === 'session' && scenario) return <Session s={scenario} classCode={classCode} device={device} onExit={() => setView('journey')} onStamp={stamp} />;
  if (view === 'journey' && module) return <Journey module={module} passport={passport} onBack={() => setView('home')} onPick={s => { setScenario(s); setView('session'); }} />;
  return <Home classCode={classCode} setClassCode={setClassCode} device={device} setDevice={setDevice} passport={passport} onModule={m => { setModule(m); setView('journey'); }} />;
}

function Home({ classCode, setClassCode, device, setDevice, passport, onModule }) {
  const [editing, setEditing] = useState(!classCode);
  const [draft, setDraft] = useState(classCode); const [dev, setDev] = useState(device);
  const done = Object.values(passport).filter(p => p.done).length;
  return (
    <main className="wrap">
      <header className="row between">
        <div className="row"><img src="/icons/icon-192.png" alt="" width="40" height="40" style={{ borderRadius: 12 }} /><div><div className="eyebrow">Future Skills</div><h1 style={{ fontSize: 24 }}>Life Lab</h1></div></div>
        <button type="button" className="btn ghost small" onClick={() => setEditing(true)} aria-label={`Class code ${classCode || 'not set'}, change`}>{classCode ? `Class ${classCode}` : 'Enter class code'}</button>
      </header>
      {editing && <form className="card col" onSubmit={e => { e.preventDefault(); if (/^[A-Z0-9-]{2,12}$/.test(draft)) { setClassCode(draft); setDevice(dev.trim()); setEditing(false); } }}>
        <h2 style={{ fontSize: 22 }}>Type the code your teacher gave you.</h2>
        <p className="muted small">It keeps your passport safe on this device and isn't linked to your name.</p>
        <label>Class code<input value={draft} onChange={e => setDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12))} placeholder="OAK-14" autoCapitalize="characters" required /></label>
        <label>Device nickname <span className="muted small">(teacher sets this, e.g. iPad 7)</span><input value={dev} onChange={e => setDev(e.target.value.slice(0, 24))} placeholder="iPad 7" /></label>
        <button className="btn" type="submit">Use this code</button>
      </form>}
      <h2 style={{ fontSize: 32 }}>Try a real-life puzzle.<br /><span className="muted" style={{ fontWeight: 500 }}>Then explain how you did it.</span></h2>
      <div className="col" style={{ gap: 12 }}>
        {MODULES.map(m => { const list = SCENARIOS.filter(s => MODULE_OF(s) === m); const th = THEME[list[0].mode]; const glyph = { MoneyWise: '£', CookSmart: 'g', 'Digital Life': '@', Enterprise: '%' }[m]; const n = list.filter(s => passport[s.id]?.done).length; return (
          <button type="button" key={m} className="mode" style={{ background: th.accent }} onClick={() => classCode ? onModule(m) : setEditing(true)}>
            <span className="glyph" aria-hidden="true">{glyph}</span>
            <span className="eyebrow" style={{ color: 'rgba(255,255,255,.85)' }}>Module</span>
            <span><span className="display" style={{ fontSize: 28, fontWeight: 700, display: 'block' }}>{m}</span><span style={{ opacity: .92 }}>{{ MoneyWise: 'Coins, saving, spotting tricks', CookSmart: 'Where food comes from, healthy plates, safe cooking', 'Digital Life': 'Staying safe with money online', Enterprise: 'Run a stall: cost, price, profit, break-even, stay safe' }[m]}</span></span>
            <span className="small" style={{ fontWeight: 600, background: 'rgba(255,255,255,.18)', padding: '5px 10px', borderRadius: 999, alignSelf: 'flex-start' }}>{list.length} levels · {n} stamped</span>
          </button>); })}
      </div>
      <Passport passport={passport} />
      <p className="muted small" style={{ marginTop: 'auto' }}><strong>About your data.</strong> Life Lab records anonymous information about how activities are completed so teachers can understand whether the programme is supporting learning. It does not need your name, home address or personal financial information. {done} stamped on this device.</p>
      <a href="/teacher" className="btn ghost small" style={{ alignSelf: 'flex-start' }}>Teacher view</a>
    </main>);
}

function Passport({ passport }) {
  return (
    <section className="card col" aria-label="Future Skills Passport">
      <div className="row between"><h2 style={{ fontSize: 18 }}>Future Skills Passport</h2><span className="muted small">{Object.values(passport).filter(p => p.done).length} of {SCENARIOS.length}</span></div>
      {MODULES.map(m => { const list = SCENARIOS.filter(s => MODULE_OF(s) === m); const th = THEME[list[0].mode]; return (
        <div key={m} className="col"><div className="eyebrow" style={{ color: th.accent }}>{m}</div>
          <div className="row" style={{ gap: 6 }}>{list.map((s, i) => { const p = passport[s.id]; return <div key={s.id} className={'stamp' + (p?.done ? ' done' : '')} title={s.title} aria-label={`${s.title}: ${p?.done ? (p.independent ? 'stamped, independent Apply completed' : 'stamped') : 'not yet'}`} style={p?.done ? { background: th.accent, color: '#fff', borderColor: th.accent, transform: `rotate(${(i % 3 - 1) * 6}deg)` } : {}}>{p?.done ? '✓' : '○'}</div>; })}</div>
        </div>); })}
    </section>);
}

function Journey({ module, passport, onBack, onPick }) {
  const list = SCENARIOS.filter(s => MODULE_OF(s) === module); const th = THEME[list[0].mode];
  return (
    <main className="wrap" style={{ '--accent': th.accent, '--soft': th.soft }}>
      <button type="button" className="back" onClick={onBack}>← Modules</button>
      <div><div className="eyebrow" style={{ color: th.accent }}>{module}</div><h1 style={{ fontSize: 30 }}>Your journey · gets harder each level</h1></div>
      {list.map((s, i) => { const p = passport[s.id]; return (
        <button type="button" key={s.id} className={'level' + (p?.done ? ' done' : '')} onClick={() => onPick(s)}>
          <span className="n">{i + 1}</span>
          <span style={{ flex: 1 }}><span className="eyebrow" style={{ color: th.accent }}>{s.year} · {s.block || s.stage}{s.teacherLed ? ' · teacher-led' : ''}</span><br /><strong style={{ fontSize: 17 }}>{s.title}</strong><br /><span className="muted small">{s.focus}</span></span>
          <span className="small muted">{p?.done ? (p.independent ? 'Stamped ✓ Apply ✓' : 'Stamped ✓') : 'Start'}</span>
        </button>); })}
      <p className="muted small">Levels follow the National Curriculum from Year 1 to Year 6. Start where your teacher says.</p>
    </main>);
}

function Session({ s, classCode, device, onExit, onStamp }) {
  const th = THEME[s.mode]; const A = ASSESSMENTS[s.id]; const isKs1 = s.stage === 'KS1';
  const [sid, setSid] = useState(null); const [err, setErr] = useState('');
  const [stage, setStage] = useState('explore'); // explore | think | try | reflect | apply | feedback | done | stop
  const [baseline, setBaseline] = useState(null); const [baselineScore, setBaselineScore] = useState(null);
  const [text, setText] = useState(''); const [attempts, setAttempts] = useState([]); const [hint, setHint] = useState(0); const [feed, setFeed] = useState([]); const [revised, setRevised] = useState(false);
  const [reflection, setReflection] = useState(''); const [applyChoice, setApplyChoice] = useState(null); const [applyScore, setApplyScore] = useState(null);
  const [fb, setFb] = useState({ thinking: null, independence: null, helpfulness: null, useAgain: null, learned: '' });
  const [outcome, setOutcome] = useState(null); const [pd, setPd] = useState(''); const [helped, setHelped] = useState(false); const [busy, setBusy] = useState(false);
  const started = useRef(Date.now()); const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const startedOnce = useRef(false);
  useEffect(() => { if (startedOnce.current) return; startedOnce.current = true; startSession({ classCode, scenarioId: s.id, deviceLabel: device || undefined }).then(r => setSid(r.sessionId)).catch(e => setErr('Could not start a session: ' + e.message)); }, []);
  const ev = body => sid && sendEvent({ sessionId: sid, ...body }).catch(() => {});
  const remaining = Math.max(0, LIMIT_MIN * 60 - Math.floor((now - started.current) / 1000));
  const lowTime = remaining < 300 && !['done', 'stop'].includes(stage);
  const stageIdx = { explore: 0, think: 1, try: 2, reflect: 3, apply: 4, feedback: 4, done: 4, stop: 4 }[stage];

  // Deterministic gate: personal data → inline warning; safeguarding → stop screen. Text is never sent anywhere.
  const gate = (t, evStage) => { const g = gateText(t); if (!g.blocked) return true;
    if (g.reason === 'safeguarding_disclosure') { setStage('stop'); ev({ event: 'safety_stop', stage: evStage, safetyCategory: 'safeguarding_disclosure' }); setText(''); setReflection(''); }
    else { setPd(g.kind); ev({ event: 'safety_stop', stage: evStage, safetyCategory: 'personal_information' }); }
    return false; };

  const submitBaseline = async () => { if (baseline == null) return; setBusy(true); const r = await sendEvent({ sessionId: sid, event: 'baseline_completed', stage: 'explore', choice: baseline }).catch(() => null); setBaselineScore(r?.score ?? null); setBusy(false); setStage('think'); };
  const submitThink = async () => { const t = text.trim(); if (!gate(t, 'think')) return; if (t.length < 8) { setErr('Tell me a little more — what would you do, and why?'); return; } setErr('');
    const score = hits(t, s); setAttempts([t]); ev({ event: 'attempt_submitted', stage: 'think', attemptNumber: 1, score });
    setBusy(true); const c = await coach({ sessionId: sid, scenarioId: s.id, stage: 'think', permittedLevel: 0, pupilText: t, attemptNumber: 1 }); setBusy(false);
    setFeed([{ kind: 'attempt', label: 'Attempt 1', text: t }, { kind: 'coach', label: 'Coach', text: c?.text || s.think, src: c?.source }]); setText(''); setStage('try'); };
  const submitAttempt = async () => { const t = text.trim(); if (!gate(t, 'try')) return; if (t.length < 8) { setErr('Tell me a little more — what would you do, and why?'); return; } setErr('');
    const n = attempts.length + 1; const score = hits(t, s); setAttempts(a => [...a, t]); ev({ event: 'attempt_submitted', stage: 'try', attemptNumber: n, score }); if (revised) { ev({ event: 'answer_revised', stage: 'try', attemptNumber: n }); setRevised(false); }
    setBusy(true); const c = await coach({ sessionId: sid, scenarioId: s.id, stage: 'try_feedback', permittedLevel: hint, pupilText: t, attemptNumber: n }); setBusy(false);
    const fallback = 'Well done for having a go. Before you open a hint, ask yourself: how do I know? Could I count it, check it or explain it to a friend?';
    setFeed(f => [...f, { kind: 'attempt', label: `Attempt ${n}`, text: t }, { kind: 'coach', label: 'Coach', text: c?.text || fallback, src: c?.source }]); setText(''); };
  const giveHint = async () => { if (!attempts.length) { setFeed(f => [...f, { kind: 'coach', label: 'Coach', text: 'Have a go first — even a guess. Then I will help.' }]); return; }
    const next = Math.min(hint + 1, 7); if (next >= 7 && attempts.length < 2) { setFeed(f => [...f, { kind: 'coach', label: 'Coach', text: 'The answer unlocks after two real attempts and your reflection. Try once more first.' }]); return; }
    if (next >= 7) { setFeed(f => [...f, { kind: 'coach', label: 'Coach', text: 'The answer unlocks after your reflection. Use the hints you have and try once more first.' }]); return; }
    setHint(next); const c = next <= 4 ? await coach({ sessionId: sid, scenarioId: s.id, stage: 'try_hint', permittedLevel: next, pupilText: attempts[attempts.length - 1], attemptNumber: attempts.length }) : null;
    ev({ event: 'hint_used', stage: 'try', hintLevel: next, aiUsed: c?.source === 'ai' }); setFeed(f => [...f, { kind: 'hint', label: `Hint ${next} · ${HINT_LABELS[next - 1]}`, text: c?.text || s.hints[next - 1], src: c?.source }]); };
  const submitReflection = () => { const t = reflection.trim(); if (!gate(t, 'reflect')) return; if (t.length < 8) { setErr('Write one sentence about what you learned.'); return; } setErr(''); ev({ event: 'reflection_completed', stage: 'reflect' }); ev({ event: 'apply_started', stage: 'apply' }); setStage('apply'); };
  const submitApply = async () => { if (applyChoice == null) return; setBusy(true); const r = await sendEvent({ sessionId: sid, event: 'apply_completed', stage: 'apply', choice: applyChoice }).catch(() => null); setApplyScore(r?.score ?? null); setBusy(false); setStage('feedback'); };
  const finish = async () => { setBusy(true); ev({ event: 'feedback_completed', stage: 'feedback' });
    const r = await completeSession({ sessionId: sid, thinking: fb.thinking ?? undefined, independence: fb.independence ?? undefined, helpfulness: fb.helpfulness ?? undefined, useAgain: fb.useAgain ?? undefined, reflection: fb.learned || undefined, teacherIntervention: helped }).catch(() => null);
    setOutcome(r?.outcome || null); onStamp(s.id, { independent: (r?.outcome?.apply ?? applyScore) === 100 && r?.outcome?.band === 'independent', reflection: reflection.slice(0, 120) }); setBusy(false); setStage('done'); };

  const stop = <main className="wrap dark" role="alert"><div className="eyebrow" style={{ color: 'rgba(245,240,230,.75)' }}>Let's pause here</div><h1 style={{ fontSize: 34 }}>This app can't help with what you've written — but a grown-up can.</h1><p style={{ fontSize: 17 }}>Please stop and tell your teacher or another grown-up you trust right now. They will listen and help you. What you wrote has not been sent anywhere.</p><div className="card" style={{ background: 'rgba(245,240,230,.1)', border: 0 }}><strong>If you can't reach a teacher</strong><br />Childline is free any time: <strong>0800 1111</strong>. If someone is in danger right now, call <strong>999</strong>.</div><p className="muted small">Your teacher's screen shows that this session paused — not what you wrote.</p><Listen text="Let us pause here. This app cannot help with what you have written, but a grown-up can. Please stop and tell your teacher or another grown-up you trust right now." /><button type="button" className="btn" style={{ marginTop: 'auto', background: '#F5F0E6', color: '#1C1B18' }} onClick={onExit}>Return to start</button></main>;
  if (stage === 'stop') return stop;

  return (
    <main className="wrap" style={{ '--accent': th.accent, '--soft': th.soft }}>
      {lowTime && <div className="timer" role="status">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')} left · wrap up soon</div>}
      <div className="topbar"><div className="row between"><button type="button" className="back" style={{ minHeight: 36, padding: 0 }} onClick={onExit}>← {MODULE_OF(s)}</button><span className="small muted">Level {SCENARIOS.filter(x => MODULE_OF(x) === MODULE_OF(s)).indexOf(s) + 1}</span></div><Steps at={stageIdx} /></div>
      <div><div className="eyebrow" style={{ color: th.accent }}>{s.year} · {s.focus}</div><h1 style={{ fontSize: 30 }}>{s.title}</h1></div>
      {err && <div className="warn" role="alert">{err}</div>}
      {pd && <div className="card col" role="dialog" aria-modal="true" style={{ borderColor: 'var(--warn)' }}><div className="eyebrow" style={{ color: 'var(--warn)' }}>Keep it fictional</div><strong>That looks like {pd}.</strong><span className="small">Nothing has been saved. Use a made-up one instead — your thinking is what counts.</span><button type="button" className="btn small" onClick={() => setPd('')}>Edit my answer</button></div>}

      {stage === 'explore' && <>
        <div className="card" style={{ fontSize: isKs1 ? 18 : 16 }}>{s.brief}</div>
        <Listen text={`${s.title}. ${s.brief}`} />
        {s.safety && <details className="card dark"><summary style={{ fontWeight: 700, cursor: 'pointer' }}>Stay safe · 3 rules</summary><ol style={{ paddingLeft: 20, margin: '10px 0 0' }}>{s.safety.map(m => <li key={m.t} style={{ marginBottom: 8 }}><strong>{m.t}</strong> — {m.d}</li>)}</ol></details>}
        <section className="card col" aria-label="Quick check before we start">
          <div className="eyebrow" style={{ color: th.accent }}>Explore · quick check, no help yet</div>
          <strong style={{ fontSize: 17 }}>{A.baseline.q}</strong>
          <Choices options={A.baseline.options} value={baseline} onChange={setBaseline} />
          <button type="button" className="btn" disabled={baseline == null || !sid || busy} onClick={submitBaseline}>Lock in my answer →</button>
          {!sid && !err && <span className="muted small" role="status">Connecting to your class…</span>}
        </section>
      </>}

      {stage === 'think' && <>
        <div className="card" style={{ background: th.soft, border: 0 }}><span className="eyebrow" style={{ color: th.accent }}>Think</span><br />{s.think}</div>
        <details className="card"><summary style={{ fontWeight: 600, cursor: 'pointer' }}>The challenge</summary><p style={{ margin: '8px 0 0' }}>{s.brief}</p></details>
        <label>What's your first approach — and why?<textarea rows={5} value={text} onChange={e => setText(e.target.value)} placeholder="Even a guess counts as a go. Use made-up names only." /></label>
        <button type="button" className="btn accent" disabled={busy} onClick={submitThink}>{busy ? 'Thinking…' : 'That\'s my first idea →'}</button>
      </>}

      {stage === 'try' && <>
        <details className="card"><summary style={{ fontWeight: 600, cursor: 'pointer' }}>The challenge</summary><p style={{ margin: '8px 0 0' }}>{s.brief}</p></details>
        {s.safety && <details className="card dark"><summary style={{ fontWeight: 700, cursor: 'pointer' }}>Stay safe · 3 rules</summary><ol style={{ paddingLeft: 20, margin: '10px 0 0' }}>{s.safety.map(m => <li key={m.t} style={{ marginBottom: 8 }}><strong>{m.t}</strong> — {m.d}</li>)}</ol></details>}
        <label>Have another go<textarea rows={5} value={text} onChange={e => { setText(e.target.value); if (attempts.length) setRevised(true); }} placeholder="What would you do — and why does it work?" /></label>
        <div className="row"><button type="button" className="btn accent" style={{ flex: 1 }} disabled={busy} onClick={submitAttempt}>Submit attempt</button><button type="button" className="btn ghost" style={{ flex: 1 }} disabled={busy} onClick={giveHint}>{hint >= 6 ? 'Answer locked' : hint ? `Next hint (${hint + 1})` : 'Get a hint'}</button></div>
        <div className="col" style={{ gap: 6 }}><div className="row between small muted"><span>Hint ladder</span><span>{hint ? `${hint} of 6 opened` : 'none opened'}</span></div><div className="ladder" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} className={i < hint ? 'on' : ''} />)}<span className="lock" /></div><span className="small muted">The answer (level 7) unlocks after two attempts and your reflection.</span></div>
        <label className="row small"><input type="checkbox" style={{ width: 20, height: 20 }} checked={helped} onChange={e => { setHelped(e.target.checked); if (e.target.checked) ev({ event: 'teacher_help_requested', stage: 'try' }); }} /> My teacher helped me with this one</label>
        {feed.length > 0 && <div className="feed" aria-live="polite">{[...feed].reverse().map((f, i) => <div key={i} className={'item ' + f.kind}><div className="row between"><span className="eyebrow" style={{ color: f.kind === 'hint' ? 'var(--ink)' : th.accent }}>{f.label}</span><span className="row"><span className="small muted">{f.src === 'ai' ? 'AI-assisted, checked by the app' : f.kind === 'attempt' ? 'you' : 'pre-written'}</span><Listen small text={f.text} /></span></div><div style={{ fontSize: isKs1 ? 18 : 16 }}>{f.text}</div></div>)}</div>}
        {attempts.length > 0 && <button type="button" className="btn" onClick={() => setStage('reflect')}>I'm ready to think back →</button>}
      </>}

      {stage === 'reflect' && <>
        <div className="card" style={{ background: th.soft, border: 0 }}><span className="eyebrow" style={{ color: th.accent }}>Reflect</span><br />{s.reflection}</div>
        <div className="row"><span className="card small" style={{ flex: 1 }}><span className="kpi" style={{ fontSize: 22 }}>{attempts.length}</span><br />attempts</span><span className="card small" style={{ flex: 1 }}><span className="kpi" style={{ fontSize: 22 }}>{hint}</span><br />highest hint</span></div>
        <label>What worked? What would you change? What have you learned?<textarea rows={4} value={reflection} onChange={e => setReflection(e.target.value)} /></label>
        <button type="button" className="btn" onClick={submitReflection}>Save my reflection →</button>
      </>}

      {stage === 'apply' && <>
        <div className="card dark small">Coach switched off. No hints — this shows what you can do by yourself.</div>
        <section className="card col"><div className="eyebrow" style={{ color: th.accent }}>Apply · a fresh problem</div><strong style={{ fontSize: 17 }}>{A.apply.q}</strong><Listen small text={A.apply.q + '. ' + A.apply.options.join('. ')} /><Choices options={A.apply.options} value={applyChoice} onChange={setApplyChoice} /><button type="button" className="btn" disabled={applyChoice == null || busy} onClick={submitApply}>Hand in →</button></section>
      </>}

      {stage === 'feedback' && <section className="card col" aria-label="Four quick questions">
        <h2 style={{ fontSize: 22 }}>Four quick questions</h2>
        {[['thinking', 'How much did this challenge make you think?', ['Not much', 'A little', 'Quite a lot', 'A lot']], ['independence', 'Could you do something similar without the coach now?', ['Not yet', 'Maybe', 'Probably', 'Yes']], ['helpfulness', 'Was the support helpful?', ['Not helpful', 'A little', 'Helpful', 'Very helpful']], ['useAgain', 'Would you do another Life Lab challenge?', ['No', 'Maybe', 'Yes']]].map(([k, q, opts]) => (
          <div key={k} className="col"><strong>{q}</strong><div className="row">{opts.map((o, i) => <button type="button" key={o} className={'btn small ' + (fb[k] === i + 1 ? 'accent' : 'ghost')} aria-pressed={fb[k] === i + 1} onClick={() => setFb({ ...fb, [k]: i + 1 })}>{o}</button>)}</div></div>))}
        <label>Tell us one thing you learned <span className="muted small">(optional)</span><input maxLength={200} value={fb.learned} onChange={e => setFb({ ...fb, learned: e.target.value })} /></label>
        <button type="button" className="btn" disabled={busy || fb.thinking == null} onClick={finish}>{busy ? 'Saving…' : 'Finish →'}</button>
      </section>}

      {stage === 'done' && <>
        <div className="pop" style={{ alignSelf: 'center', width: 120, height: 120, borderRadius: '50%', background: th.accent, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 12px 30px -12px rgba(28,27,24,.4)' }}><span className="display" style={{ fontSize: 28, fontWeight: 800, textAlign: 'center' }}>{s.short}<br /><span style={{ fontSize: 11, letterSpacing: '.14em' }}>STAMPED</span></span></div>
        <h2 style={{ fontSize: 28, textAlign: 'center' }}>{SKILLS[s.id] ? 'Enterprise Challenge Complete' : 'Nicely done.'}</h2>
        <p className="muted" style={{ textAlign: 'center' }}>{attempts.length} attempt{attempts.length === 1 ? '' : 's'}, highest hint {hint}. Independent challenge: <strong>{(outcome?.apply ?? applyScore) === 100 ? 'Completed' : 'Attempted'}</strong>.{outcome?.completedWithoutAi ? ' No AI help was shown.' : ''}</p>
        {SKILLS[s.id] && <div className="card"><strong>You practised:</strong><ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{SKILLS[s.id].map(k => <li key={k}>✓ {k}</li>)}</ul></div>}
        <details className="card"><summary style={{ fontWeight: 600, cursor: 'pointer' }}>The answer · compare with yours</summary><p style={{ margin: '8px 0 0' }}>{s.hints[6]}</p></details>
        <button type="button" className="btn" style={{ marginTop: 'auto' }} onClick={onExit}>Back to the journey</button>
      </>}
    </main>);
}
