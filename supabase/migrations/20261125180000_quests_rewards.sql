-- =====================================================================
-- Phase 2b: boss battles, rewards (+ claims), Nicos Weg lessons.
-- Daily and weekly quests, coins and reward unlocks are computed, not stored.
-- Safe to run more than once. Deletes nothing.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Boss battles (big goals with a progress bar). Seeded by the app the
--    first time (stable ids like 'boss-ca-interviews'); add your own too.
--    auto: progress is computed by the app ('nicos_weg', 'strength_level');
--    otherwise you move it with + / −.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boss_battles (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id          TEXT NOT NULL CHECK (char_length(id) BETWEEN 1 AND 80),
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    skill       TEXT NOT NULL CHECK (skill IN ('body', 'mind', 'business', 'glow', 'family')),
    target      INTEGER NOT NULL CHECK (target BETWEEN 1 AND 10000),
    progress    INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 10000),
    auto        TEXT CHECK (auto IN ('nicos_weg', 'strength_level')),
    -- the day it was beaten (manual bosses); +200 XP that day
    done_on     DATE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- ---------------------------------------------------------------------
-- 2. Rewards you can buy with coins (editable list; seeded once).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewards (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id          TEXT NOT NULL CHECK (char_length(id) BETWEEN 1 AND 80),
    tier        TEXT NOT NULL CHECK (tier IN ('small', 'medium', 'big', 'epic')),
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    cost        INTEGER NOT NULL CHECK (cost BETWEEN 0 AND 100000),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- ---------------------------------------------------------------------
-- 3. Reward claims: what you spent coins on. Add-only, like xp_events
--    (no UPDATE / DELETE policy), so your coin history can't change.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_claims (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reward_id   TEXT NOT NULL,
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    cost        INTEGER NOT NULL CHECK (cost BETWEEN 0 AND 100000),
    claimed_on  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reward_claims_user ON public.reward_claims (user_id, claimed_on);

-- ---------------------------------------------------------------------
-- 4. Nicos Weg (DW, A1): one row per lesson you've done.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.german_lessons (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson      INTEGER NOT NULL CHECK (lesson BETWEEN 1 AND 500),
    title       TEXT CHECK (char_length(title) <= 200),
    done_on     DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, lesson)
);

-- ---------------------------------------------------------------------
-- RLS: your own rows only.
-- ---------------------------------------------------------------------
ALTER TABLE public.boss_battles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_claims  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.german_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boss_battles_own" ON public.boss_battles;
CREATE POLICY "boss_battles_own" ON public.boss_battles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "rewards_own" ON public.rewards;
CREATE POLICY "rewards_own" ON public.rewards
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reward_claims_select_own" ON public.reward_claims;
CREATE POLICY "reward_claims_select_own" ON public.reward_claims
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "reward_claims_insert_own" ON public.reward_claims;
CREATE POLICY "reward_claims_insert_own" ON public.reward_claims
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "german_lessons_own" ON public.german_lessons;
CREATE POLICY "german_lessons_own" ON public.german_lessons
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 5. Saturdays: Nicos Weg replaces the DW German task, so every Saturday
--    is "Light review" (only the not-yet-used German Saturdays change).
-- ---------------------------------------------------------------------
UPDATE public.plan_tasks
   SET text = 'Light review: re-read this week''s R + JS notes'
 WHERE id IN ('study-sat-02', 'study-sat-04', 'study-sat-06', 'study-sat-08', 'study-sat-10', 'study-sat-12')
   AND text LIKE 'German:%';

-- ---------------------------------------------------------------------
-- 6. Live sync.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['boss_battles', 'rewards', 'reward_claims', 'german_lessons']
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
