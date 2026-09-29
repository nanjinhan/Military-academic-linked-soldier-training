-- PostgreSQL 15+ / Supabase-compatible. Server-only access.
BEGIN;
CREATE SCHEMA IF NOT EXISTS fitness;
REVOKE ALL ON SCHEMA fitness FROM PUBLIC;
CREATE TABLE IF NOT EXISTS fitness.schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS fitness.user_profiles (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 role text GENERATED ALWAYS AS (payload->>'role') STORED NOT NULL CHECK (role IN ('soldier','admin')),
 unit_id text GENERATED ALWAYS AS (payload->>'unit') STORED NOT NULL,
 CHECK (payload->>'id'=id)
);
CREATE TABLE IF NOT EXISTS fitness.goals (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 user_id text GENERATED ALWAYS AS (payload->>'userId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 CHECK (payload->>'id'=id), CHECK (jsonb_typeof(payload->'days')='array'),
 CHECK ((payload->>'minutes')::integer BETWEEN 10 AND 90)
);
CREATE TABLE IF NOT EXISTS fitness.routine_sessions (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 user_id text GENERATED ALWAYS AS (payload->>'userId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 goal_id text GENERATED ALWAYS AS (payload->>'goalId') STORED NOT NULL REFERENCES fitness.goals(id),
 session_date text GENERATED ALWAYS AS (payload->>'date') STORED NOT NULL,
 UNIQUE(user_id,session_date), CHECK (payload->>'id'=id),
 CHECK (payload->>'type' IN ('training','rest','recovery')),
 CHECK (jsonb_typeof(payload->'history')='array')
);
CREATE TABLE IF NOT EXISTS fitness.submissions (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 user_id text GENERATED ALWAYS AS (payload->>'userId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 routine_id text GENERATED ALWAYS AS (payload->>'routineId') STORED REFERENCES fitness.routine_sessions(id),
 idempotency_key text GENERATED ALWAYS AS (payload->>'idempotencyKey') STORED NOT NULL,
 kind text GENERATED ALWAYS AS (payload->>'kind') STORED NOT NULL CHECK(kind IN ('performance','measurement','self')),
 status text GENERATED ALWAYS AS (payload->>'status') STORED NOT NULL CHECK(status IN ('pending','approved','changes','rejected','revoked')),
 UNIQUE(user_id,idempotency_key), CHECK (payload->>'id'=id),
 CHECK ((kind='performance' AND routine_id IS NOT NULL) OR (kind<>'performance' AND routine_id IS NULL)),
 CHECK ((payload->>'rpe')::integer BETWEEN 1 AND 10),
 CHECK ((payload->>'fatigue')::integer BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_submission_per_routine ON fitness.submissions(routine_id) WHERE routine_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS submission_review_queue ON fitness.submissions(status,user_id);
CREATE INDEX IF NOT EXISTS measurement_comparison ON fitness.submissions((payload->>'sport'),(payload->>'group'),(payload->>'date')) WHERE kind='measurement' AND status='approved';
CREATE TABLE IF NOT EXISTS fitness.reviews (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 submission_id text GENERATED ALWAYS AS (payload->>'submissionId') STORED NOT NULL REFERENCES fitness.submissions(id),
 admin_id text GENERATED ALWAYS AS (payload->>'adminId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 CHECK (payload->>'id'=id), CHECK(payload->>'action' IN ('approved','changes','rejected','revoked'))
);
CREATE TABLE IF NOT EXISTS fitness.official_results (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 user_id text GENERATED ALWAYS AS (payload->>'userId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 CHECK(payload->>'id'=id), CHECK(length(payload->>'standard')>0)
);
CREATE TABLE IF NOT EXISTS fitness.recovery_checkins (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 user_id text GENERATED ALWAYS AS (payload->>'userId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 CHECK(payload->>'id'=id), CHECK((payload->>'fatigue')::integer BETWEEN 1 AND 5)
);
CREATE TABLE IF NOT EXISTS fitness.xp_ledger (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 user_id text GENERATED ALWAYS AS (payload->>'userId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 submission_id text GENERATED ALWAYS AS (payload->>'submissionId') STORED NOT NULL UNIQUE REFERENCES fitness.submissions(id),
 CHECK(payload->>'id'=id), CHECK((payload->>'amount')::integer BETWEEN 0 AND 80)
);
CREATE TABLE IF NOT EXISTS fitness.audit_events (
 sequence_id bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 id text PRIMARY KEY, payload jsonb NOT NULL,
 actor_id text GENERATED ALWAYS AS (payload->>'actorId') STORED NOT NULL REFERENCES fitness.user_profiles(id),
 CHECK(payload->>'id'=id)
);
CREATE INDEX IF NOT EXISTS routine_user_date ON fitness.routine_sessions(user_id,session_date);
CREATE INDEX IF NOT EXISTS goals_user ON fitness.goals(user_id);
CREATE INDEX IF NOT EXISTS reviews_submission ON fitness.reviews(submission_id);
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['user_profiles','goals','routine_sessions','submissions','reviews','official_results','recovery_checkins','xp_ledger','audit_events'] LOOP
  EXECUTE format('ALTER TABLE fitness.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON fitness.%I FROM PUBLIC',tab);
 END LOOP;
END $$;
-- No browser/anon policies: server role must be separately provisioned.
INSERT INTO fitness.schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
COMMIT;
