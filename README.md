# Future Skills Life Lab — Netlify PWA MVP v4

Pupil PWA → Netlify Functions → Netlify DB (Postgres/Neon) → Teacher Evidence Dashboard.
MoneyWise · CookSmart · Digital Life · Enterprise (Juice Shots + Healthy Wraps) — 19 approved scenarios, Y1–Y6,
Explore → Think → Try → Reflect → Apply, with evidence collection built into the cycle.

The product exists to show whether pupils **engage → learn → become more independent → have a positive experience**,
and whether **teacher workload is manageable** and **safeguards work**. It measures the learning pathway
(attempt → hint → revision → success → independent Apply), never "minutes of AI use".

## Project structure

```
netlify.toml                 build, functions dir, /api/* aliases, security headers
index.html · vite.config.js  Vite + React app shell
public/manifest.webmanifest  PWA manifest · public/sw.js service worker (app shell only) · public/icons/
src/main.jsx                 routes: /  (pupil PWA)   /teacher (dashboard)
src/pupil/Pupil.jsx          home, class code, journey, session flow, feedback, passport
src/teacher/Teacher.jsx      Identity gate, six evidence areas, check-out, safety review
src/scenarios.js             approved scenario library (ported unchanged from the prototype)
src/assessments.js           baseline + Apply tap-questions (scored server-side)
src/safety.js                deterministic gate + model-output filter (shared by client and functions)
src/api.js                   event client with offline queue; teacher fetch with Identity token
netlify/functions/
  _lib/http.mjs              db, validation, rate limit, requireTeacher (JWT + role check)
  session-start.mjs          POST /api/session/start
  session-event.mjs          POST /api/session/event   (scores baseline/Apply server-side; writes safety_events)
  session-complete.mjs       POST /api/session/complete (derives outcomes from the event log; stores feedback)
  teacher-summary.mjs        GET  /api/teacher/summary  (teacher role)
  teacher-checkout.mjs       POST /api/teacher/checkout (teacher role)
  safety-review.mjs          GET/POST /api/safety/review (teacher role)
  coach.mjs                  POST /api/coach — Azure OpenAI, server-side only
db/migrations/001_init.sql   relational schema · db/demo_seed.sql DEMONSTRATION DATA
scripts/migrate.mjs          npm run db:migrate | npm run db:demo
.env.example · .gitignore
```

## Step A — GitHub
1. Create a GitHub repository. 2. Add this folder's contents at the repo root. 3. Commit. 4. Push to `main`.

## Step B — Netlify
1. Log into Netlify → **Add new project** → **Import an existing project** → GitHub → select the repository.
2. Netlify reads `netlify.toml` (build `npm run build`, publish `dist`, functions `netlify/functions`). Deploy.

## Step C — Database
1. In the site → **Extensions / Integrations → Netlify DB (Neon)** → add. This sets `NETLIFY_DATABASE_URL` for functions.
2. Locally: `npm i`, `netlify link`, `netlify env:pull .env` (or copy the URL into `.env`), then `npm run db:migrate`.
   For demo data: `npm run db:demo` (labelled **DEMONSTRATION DATA — NOT REAL PUPILS**, school_code `DEMO`).
3. Confirm: open `/api/teacher/summary` while signed in as a teacher — it should return JSON.
Database credentials never reach the browser (functions only).

## Step D — Environment variables (Site settings → Environment variables)
| Variable | Purpose |
|---|---|
| `NETLIFY_DATABASE_URL` | set by the Netlify DB integration |
| `LIFE_LAB_SCHOOL_CODE` | pseudonymous school label on every row, e.g. `OAKFIELD` |
| `LIFE_LAB_DEMO_MODE` | `true` shows DEMO rows on the dashboard — set `false` before the pilot |
| `LIFE_LAB_AI_MODE` | `off` (default) · `shadow` (call + audit, show teacher hints) · `on` |
| `AZURE_OPENAI_ENDPOINT` | `https://<resource>.openai.azure.com/` — server-side only |
| `AZURE_OPENAI_DEPLOYMENT` | your approved deployment name |
| `AZURE_OPENAI_API_KEY` | key (functions only; never in `VITE_*`) |
| `VITE_SCHOOL_CODE`, `VITE_DEMO_MODE` | optional, client-visible labels only |
Never commit secrets; `.env*` is git-ignored.

## Step E — Identity
1. Site → **Identity → Enable**. Registration → **Invite only**. 2. Invite the teacher's email. 3. Identity → user → **Roles** → add `teacher`.
4. `/teacher` shows a sign-in; every teacher function re-verifies the JWT and the `teacher` role server-side (UI hiding is not the boundary).

## Step F — Production test checklist
- [ ] `/` loads; "Install app" offered on mobile/Chromebook (manifest + sw)
- [ ] Enter a class code → start any level → session row appears in `sessions`
- [ ] Baseline tap → `learning_events.baseline_completed` with server-side `score`
- [ ] Think → attempt → hint → `attempt_submitted`, `hint_used` rows
- [ ] Apply → `apply_completed` with `ai_used=false`; `/api/coach` is never called on Explore or Apply
- [ ] Feedback → `pupil_feedback` row; `outcomes` row with `learning_gain`, `independence_band`
- [ ] Sign in at `/teacher` (role `teacher`) → six cards aggregate; a non-teacher account is refused (403 from functions)
- [ ] Type `someone is hurting me` in Try → stop screen; `safety_events` row (category only, no text); mark reviewed on the Safety tab
- [ ] With `LIFE_LAB_AI_MODE=off` hints are teacher-authored; with Azure unreachable the same hints appear (fallback)
- [ ] `grep -r AZURE dist/` returns nothing (secrets absent from the client bundle)
- [ ] Set `LIFE_LAB_DEMO_MODE=false`, redeploy, banner disappears

## Manual Netlify actions you must take
Enable Netlify DB integration · run `npm run db:migrate` (and `db:demo` if wanted) · enable Identity (invite-only) · invite teacher + add `teacher` role · set env vars above · redeploy.

## Exact next action
Push this folder to GitHub, import it in Netlify, add the Netlify DB extension, run `npm run db:demo`, enable Identity and invite yourself as `teacher`, then open the deploy URL Netlify gives you (`https://<site-name>.netlify.app`) and `/teacher`.

## Evidence model (what is stored)
Tables: `sessions`, `learning_events`, `outcomes`, `pupil_feedback`, `teacher_sessions`, `safety_events`.
Not collected: names, emails, DOB, addresses, ethnicity, SEND, health, household finances or circumstances.
Pupil free text stays on the device except (a) coach turns, gate-checked client- and server-side, sent with no identifiers, `store=false`;
(b) the optional ≤200-character "one thing you learned", gate-checked before storage.
Independence bands (independent / scaffolded / significant scaffold) are programme-evaluation categories computed at class level — never shown per pupil, never ranked.

## Safeguarding (read this)
`safety_events` holds **operational fields only** — category, timestamps, review status, device label. No disclosure text, no risk scores,
no predictions, and the model is never asked to judge risk. A genuine concern must be handled through the school's existing DSL procedure;
the dashboard's "Mark reviewed" records that this happened, it does not replace it.

## Before a school pilot (not automatically GDPR-compliant)
DPIA · privacy notice · retention policy (sessions/events, exports, device passports) · access-control review (Identity roles) ·
supplier/processor assessment (Netlify, Neon, Microsoft Azure OpenAI incl. abuse-monitoring and data-zone choices) · safeguarding review by the DSL · IT/security approval.

## Known limitations
- The build and functions have been written and desk-reviewed but **not executed** by the author of this package: run `npm i && npm run build` and the checklist above before declaring completion.
- Rate limiting is per warm function instance (best-effort); add a shared store for multi-school scale.
- Offline mode caches the app shell and replays anonymous learning events; coach turns and Apply scoring require a connection.
- KS1 levels in this build use text answers for Think/Try (baseline and Apply are tap-answers); pair Y1–Y2 with an adult scribe or use the tap-mode mobile prototype.
- Passport is device/class-code based by design; no cross-device pupil identity exists in the MVP.
