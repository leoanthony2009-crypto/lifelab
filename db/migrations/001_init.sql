-- Future Skills Life Lab — evidence schema (v4)
-- Data minimisation: no names, emails, DOB, addresses, protected characteristics, health or household data.
-- Safeguarding is architecturally separate (safety_events) and holds NO disclosure text — only operational fields.

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,                       -- server-generated pseudonymous id (8 hex)
  school_code   TEXT NOT NULL,
  class_code    TEXT NOT NULL,
  key_stage     TEXT NOT NULL CHECK (key_stage IN ('KS1','KS2','KS3','KS4')),
  module        TEXT NOT NULL CHECK (module IN ('MoneyWise','CookSmart','Digital Life','Enterprise')),
  scenario      TEXT NOT NULL,
  device_label  TEXT,                                   -- teacher-set nickname, e.g. "iPad 7"
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  completed     BOOLEAN NOT NULL DEFAULT false,
  last_stage    TEXT NOT NULL DEFAULT 'explore',        -- dropout stage if never completed
  duration_s    INTEGER
);
CREATE INDEX IF NOT EXISTS sessions_class_idx ON sessions (school_code, class_code, started_at);

CREATE TABLE IF NOT EXISTS learning_events (
  id             BIGSERIAL PRIMARY KEY,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL CHECK (event_type IN (
                   'session_started','baseline_completed','attempt_submitted','hint_used','answer_revised',
                   'teacher_help_requested','stage_completed','reflection_completed','apply_started',
                   'apply_completed','feedback_completed','safety_stop','session_completed')),
  stage          TEXT,
  attempt_number INTEGER,
  hint_level     INTEGER CHECK (hint_level BETWEEN 0 AND 7),
  score          INTEGER CHECK (score BETWEEN 0 AND 100),
  ai_used        BOOLEAN,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_events_session_idx ON learning_events (session_id, created_at);

CREATE TABLE IF NOT EXISTS outcomes (
  session_id             TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  baseline_score         INTEGER CHECK (baseline_score BETWEEN 0 AND 100),
  task_score             INTEGER CHECK (task_score BETWEEN 0 AND 100),
  apply_score            INTEGER CHECK (apply_score BETWEEN 0 AND 100),
  learning_gain          INTEGER,
  attempt_count          INTEGER NOT NULL DEFAULT 0,
  attempts_before_hint   INTEGER NOT NULL DEFAULT 0,
  highest_hint           INTEGER NOT NULL DEFAULT 0,
  answer_revision_count  INTEGER NOT NULL DEFAULT 0,
  teacher_intervention   BOOLEAN NOT NULL DEFAULT false,
  completed_without_ai   BOOLEAN,
  independence_band      TEXT CHECK (independence_band IN ('independent','scaffolded','significant_scaffold')),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pupil_feedback (
  session_id                    TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  thinking_rating               SMALLINT CHECK (thinking_rating BETWEEN 1 AND 4),
  independence_rating           SMALLINT CHECK (independence_rating BETWEEN 1 AND 4),
  helpfulness_rating            SMALLINT CHECK (helpfulness_rating BETWEEN 1 AND 4),
  use_again                     SMALLINT CHECK (use_again BETWEEN 1 AND 3),   -- 3 yes, 2 maybe, 1 no
  optional_learning_reflection  VARCHAR(200),                                  -- optional, capped, gate-checked
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_sessions (
  id                      BIGSERIAL PRIMARY KEY,
  school_code             TEXT NOT NULL,
  class_code              TEXT NOT NULL,
  module                  TEXT NOT NULL,
  scenario                TEXT,
  session_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  teacher_prep_band       TEXT NOT NULL CHECK (teacher_prep_band IN ('0-5','6-10','11-20','20+')),
  teacher_help_band       TEXT NOT NULL CHECK (teacher_help_band IN ('none','few','some','many')),
  teacher_workload_rating SMALLINT NOT NULL CHECK (teacher_workload_rating BETWEEN 1 AND 5), -- 1 much more … 5 much less
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SAFEGUARDING: operational events only. NEVER store disclosure text, risk scores or predictions here.
-- A genuine concern goes to the school's DSL process outside this system.
CREATE TABLE IF NOT EXISTS safety_events (
  id                     BIGSERIAL PRIMARY KEY,
  session_id             TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  school_code            TEXT NOT NULL,
  class_code             TEXT NOT NULL,
  category               TEXT NOT NULL CHECK (category IN (
                           'personal_information','unsafe_request','food_allergen_safety',
                           'risky_financial_activity','safeguarding_disclosure','other')),
  human_review_required  BOOLEAN NOT NULL DEFAULT true,
  review_status          TEXT NOT NULL DEFAULT 'outstanding' CHECK (review_status IN ('outstanding','reviewed')),
  device_label           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS safety_events_status_idx ON safety_events (school_code, review_status, created_at);
