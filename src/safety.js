// Deterministic safety layer shared by the browser and the Functions. Never delegated to the model.
const PD = [
  [/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/, 'an email address'],
  [/\b(?:\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}\b/, 'a mobile number'],
  [/\b(?:\d[ -]*?){13,16}\b/, 'what could be a card number'],
  [/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/, 'a postcode'],
  [/\b(?:my|our) (?:address|postcode|surname|last name|date of birth|birthday is)\b/i, 'personal details'],
];
const SAFE = [
  /\b(?:hurt myself|kill myself|suicide|self[- ]harm|want to die)\b/i,
  /\b(?:someone is hurting me|hits me|hurts me|being abused|abusing me|touch(?:es|ed) me)\b/i,
  /\b(?:blackmailing me|threatening to share|scared to go home|no food at home|nobody feeds me|bullying me|bullied)\b/i,
];
export function gateText(text = '') {
  for (const [re, kind] of PD) if (re.test(text)) return { blocked: true, reason: 'personal_information', kind };
  if (SAFE.some(r => r.test(text))) return { blocked: true, reason: 'safeguarding_disclosure' };
  return { blocked: false };
}

// ---- output filter for model JSON ----------------------------------------------------------
const NUM = /£?\d+(?:[.,]\d+)?%?p?/g;
const WORD = /[a-z0-9£%½]+/g;
const FORBIDDEN = [/https?:\/\/|www\./i, /\b(what(?:'s| is) your (?:real )?name|tell me your|your (?:email|phone|address|postcode|school|birthday|date of birth|age))\b/i,
  /\b(i(?:'m| am) your friend|as your friend|i love you|i miss you|i(?:'m| am) a (?:person|human))\b/i, /\byour (?:family|parents|mum|dad|carer)s?'? (?:money|debt|benefits|income)\b/i, /\byou (?:have|might have|are) (?:diabet|obes|anorexi|allerg)/i];
const NUMWORDS = { 'sixty-five': '65', eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60', hundred: '100', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10' };
const normalise = t => Object.keys(NUMWORDS).sort((a, b) => b.length - a.length).reduce((o, w) => o.replace(new RegExp('\\b' + w + '\\b', 'g'), NUMWORDS[w]), t.toLowerCase());
const grams = (t, n = 5) => { const w = t.toLowerCase().match(WORD) || []; const g = new Set(); for (let i = 0; i + n <= w.length; i++) g.add(w.slice(i, i + n).join(' ')); return g; };
export function leakTokens(s, level = 0) {
  const k = Math.max(0, Math.min(level, 7));
  const visible = new Set(([s.brief, s.think, ...s.hints.slice(0, k)].join(' ').match(NUM) || []));
  return [...new Set((s.hints.slice(k).join(' ').match(NUM) || []))].filter(t => !visible.has(t) && t.replace(/[£p%]/g, '').length >= 2);
}
export function filterModelOutput(parsed, expectedType, level, s) {
  if (!parsed) return { message: null, reason: 'no_output' };
  const msg = String(parsed.message || '').trim(), flags = parsed.flags || [];
  if (parsed.response_type === 'refuse' || parsed.next_action === 'stop' || flags.includes('distress_language')) return { message: null, reason: 'model_refuse' };
  if (parsed.response_type !== expectedType) return { message: null, reason: 'wrong_type' };
  if (expectedType === 'hint' && parsed.hint_level !== level) return { message: null, reason: 'wrong_hint_level' };
  if (!msg || msg.split(/\s+/).length > 60) return { message: null, reason: 'length' };
  if ((msg.match(/\?/g) || []).length > 2) return { message: null, reason: 'too_many_questions' };
  if (FORBIDDEN.some(r => r.test(msg))) return { message: null, reason: 'forbidden_phrase' };
  if (level < 7) {
    const norm = normalise(msg);
    for (const tok of leakTokens(s, level)) { const bare = tok.replace(/[£p%]/g, ''); if (msg.includes(tok) || new RegExp('(?<![\\d.])' + bare.replace('.', '\\.') + '(?![\\d.])').test(norm)) return { message: null, reason: 'answer_leak:' + tok }; }
    const mg = grams(msg); for (const h of s.hints.slice(level)) for (const g of grams(h)) if (mg.has(g)) return { message: null, reason: 'answer_leak:phrase' };
    if (expectedType === 'hint' && level >= 1 && msg.split(/\s+/).length > Math.floor(s.hints[level - 1].split(/\s+/).length * 1.4) + 8) return { message: null, reason: 'hint_longer_than_source' };
  }
  return { message: msg, reason: 'ok' };
}
