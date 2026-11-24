-- =====================================================================
-- Phase 2a: XP events (the game)
-- Rows are only ever added: there is no UPDATE or DELETE policy, so
-- nobody (not even the app) can change or remove XP history.
-- Unticking something adds a matching minus row instead.
-- Levels, skills and streaks are computed from this table and the
-- planner tables, so nothing else is stored. Safe to run more than once.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.xp_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- what earned it + how many times it has changed, e.g. "task:deep-2026-11-23-0#0";
    -- unique per user, so two phones can never award the same XP twice
    event_key   TEXT NOT NULL CHECK (char_length(event_key) BETWEEN 3 AND 200),
    source      TEXT NOT NULL CHECK (char_length(source) BETWEEN 3 AND 200),
    skill       TEXT NOT NULL CHECK (skill IN ('body', 'mind', 'business', 'glow', 'family')),
    amount      INTEGER NOT NULL CHECK (amount <> 0 AND amount BETWEEN -100 AND 100),
    occurred_on DATE NOT NULL,
    reason      TEXT CHECK (char_length(reason) <= 200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS xp_events_user_event_key ON public.xp_events (user_id, event_key);
CREATE INDEX IF NOT EXISTS xp_events_user_date ON public.xp_events (user_id, occurred_on);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xp_events_select_own" ON public.xp_events;
CREATE POLICY "xp_events_select_own" ON public.xp_events
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "xp_events_insert_own" ON public.xp_events;
CREATE POLICY "xp_events_insert_own" ON public.xp_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Live sync (XP earned on one phone shows on the other)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'xp_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.xp_events;
    END IF;
END;
$$;
