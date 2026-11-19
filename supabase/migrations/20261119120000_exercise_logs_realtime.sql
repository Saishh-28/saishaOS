-- =====================================================================
-- Kingdom Phase 1: exercise_logs + live sync (Supabase Realtime)
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- exercise_logs: one row per exercise / yoga pose / cardio item per day.
-- exercise_key is a stable name such as 'squat', 'deadlift', 'cardio',
-- 'yoga-chair' (see src/planner/gym.ts), so "Last: 10 kg" can look back
-- across sessions. weight_kg is optional.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercise_logs (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    exercise_key TEXT NOT NULL CHECK (exercise_key ~ '^[a-z0-9-]{1,40}$'),
    done BOOLEAN NOT NULL DEFAULT FALSE,
    sets SMALLINT CHECK (sets BETWEEN 1 AND 20),
    reps SMALLINT CHECK (reps BETWEEN 1 AND 200),
    weight_kg NUMERIC(5, 2) CHECK (weight_kg >= 0 AND weight_kg <= 500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date, exercise_key)
);

CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_key_date ON public.exercise_logs(user_id, exercise_key, date DESC);

DROP TRIGGER IF EXISTS update_exercise_logs_modtime ON public.exercise_logs;
CREATE TRIGGER update_exercise_logs_modtime BEFORE UPDATE ON public.exercise_logs
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exercise_logs_isolation_policy ON public.exercise_logs;
CREATE POLICY exercise_logs_isolation_policy ON public.exercise_logs FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Live sync: add the planner tables to Supabase Realtime, so a tick on the
-- phone shows on the laptop within about a second. Realtime respects RLS:
-- each signed-in user only receives changes to their own rows.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    FOREACH t IN ARRAY ARRAY['plan_tasks', 'planner_days', 'daily_list_items', 'task_completions', 'habit_logs', 'exercise_logs', 'health_logs']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        END IF;
    END LOOP;
END;
$$;
