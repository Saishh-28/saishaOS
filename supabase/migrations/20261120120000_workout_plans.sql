-- =====================================================================
-- Part B: swap / reorder / add / remove gym exercises
-- Safe to run more than once. Changes no existing rows.
-- =====================================================================

-- exercise_logs.exercise_key is the exercise you actually did; planned_key
-- is the default exercise it replaced (NULL for an extra you added, and for
-- rows logged before this migration).
ALTER TABLE public.exercise_logs
    ADD COLUMN IF NOT EXISTS planned_key TEXT CHECK (planned_key ~ '^[a-z0-9-]{1,40}$');

-- Your own version of strength Day A / Day B.
--   scope = 'always'      → your permanent plan ("Always swap")
--   scope = 'YYYY-MM-DD'  → that day only ("Just today")
-- items = [{"key": "leg-press", "planned": "squat"}, {"key": "custom-…", "planned": null, "name": "…"}]
CREATE TABLE IF NOT EXISTS public.workout_plans (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    workout TEXT NOT NULL CHECK (workout IN ('A', 'B')),
    scope TEXT NOT NULL CHECK (scope = 'always' OR scope ~ '^\d{4}-\d{2}-\d{2}$'),
    items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 12),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, workout, scope)
);

DROP TRIGGER IF EXISTS update_workout_plans_modtime ON public.workout_plans;
CREATE TRIGGER update_workout_plans_modtime BEFORE UPDATE ON public.workout_plans
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS workout_plans_isolation_policy ON public.workout_plans;
CREATE POLICY workout_plans_isolation_policy ON public.workout_plans FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Live sync (Realtime)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'workout_plans'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_plans;
    END IF;
END;
$$;
