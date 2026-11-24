-- =====================================================================
-- Phase 3b: Meals (eggetarian, by weekday).
-- meal_plan: your menu for each weekday and meal (seeded once by the app
--            from your list; edit it any time, e.g. after the doctor's advice).
-- meal_logs: what you ate: the planned meal ('plan') or something else ('other').
-- Safe to run more than once. Deletes nothing.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.meal_plan (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
    slot        TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'snack', 'dinner')),
    text        TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, weekday, slot)
);

CREATE TABLE IF NOT EXISTS public.meal_logs (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    slot        TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'snack', 'dinner')),
    ate         TEXT NOT NULL CHECK (ate IN ('plan', 'other')),
    note        TEXT CHECK (char_length(note) <= 300),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date, slot)
);

ALTER TABLE public.meal_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_plan_own" ON public.meal_plan;
CREATE POLICY "meal_plan_own" ON public.meal_plan
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "meal_logs_own" ON public.meal_logs;
CREATE POLICY "meal_logs_own" ON public.meal_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['meal_plan', 'meal_logs']
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
