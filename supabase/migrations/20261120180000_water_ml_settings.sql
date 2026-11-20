-- =====================================================================
-- Part C: water in millilitres, per-user health_logs keys, user_settings
-- Safe to run more than once. Deletes nothing except exact duplicates
-- (none exist today).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. health_logs IDs (known tech debt): rows used to be identified by an ID
--    made from date + metric only, so two accounts could collide. From now
--    on the app identifies a row by (user_id, metric, logged_at) instead and
--    lets the database pick the id. Remove exact duplicates first (keeps the
--    most recently updated row), then make that combination unique.
-- ---------------------------------------------------------------------
DELETE FROM public.health_logs a
USING public.health_logs b
WHERE a.user_id = b.user_id
  AND a.metric = b.metric
  AND a.logged_at = b.logged_at
  AND (a.updated_at, a.id) < (b.updated_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS health_logs_user_metric_logged_at_key
    ON public.health_logs (user_id, metric, logged_at);

-- ---------------------------------------------------------------------
-- 2. Water: glasses (water_cups) → millilitres (water_ml, 1 glass = 250 ml).
--    The old water_cups rows are KEPT (nothing lost); the app stops using them.
--    A day that already has a water_ml row is left alone.
-- ---------------------------------------------------------------------
INSERT INTO public.health_logs (user_id, metric, value, unit, source, logged_at)
SELECT user_id, 'water_ml', (ROUND(value::numeric * 250))::int::text, 'ml', source, logged_at
FROM public.health_logs
WHERE metric = 'water_cups' AND value ~ '^\d+(\.\d+)?$'
ON CONFLICT (user_id, metric, logged_at) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. user_settings: small per-user preferences (bottle size, when the water
--    goal started, "from my bottle" anchors). One row per key.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL CHECK (key ~ '^[a-z0-9_]{1,40}$'),
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);

DROP TRIGGER IF EXISTS update_user_settings_modtime ON public.user_settings;
CREATE TRIGGER update_user_settings_modtime BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_settings_isolation_policy ON public.user_settings;
CREATE POLICY user_settings_isolation_policy ON public.user_settings FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
    END IF;
END;
$$;

-- Check (optional): SELECT metric, count(*) FROM public.health_logs GROUP BY metric ORDER BY metric;
