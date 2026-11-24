-- =====================================================================
-- Phase 2.5: Care (Moonlit Garden): skincare, hair, journal sharing, books.
-- The AM / PM routine "done" ticks stay in health_logs
-- (skin_morning_done / skin_night_done), shared with Habits and Sanctuary.
-- Safe to run more than once. Deletes nothing.
-- =====================================================================

-- 1. Your skincare routine steps (editable; seeded once by the app).
--    per_week: a step you only do a few times a week (salicylic acid: 3),
--    so it's optional on the other nights and gets a "tonight?" hint.
CREATE TABLE IF NOT EXISTS public.care_steps (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id          TEXT NOT NULL CHECK (char_length(id) BETWEEN 1 AND 80),
    routine     TEXT NOT NULL CHECK (routine IN ('am', 'pm')),
    label       TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
    per_week    SMALLINT CHECK (per_week BETWEEN 1 AND 7),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

-- 2. Skin log: steps done today, skin rating, breakout areas, note.
CREATE TABLE IF NOT EXISTS public.skin_logs (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    steps       TEXT[] NOT NULL DEFAULT '{}',
    rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
    areas       TEXT[] NOT NULL DEFAULT '{}' CHECK (areas <@ ARRAY['face', 'back', 'shoulders', 'buttocks']::TEXT[]),
    note        TEXT CHECK (char_length(note) <= 500),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- 3. Hair wash days.
CREATE TABLE IF NOT EXISTS public.hair_logs (
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    items       TEXT[] NOT NULL DEFAULT '{}'
                CHECK (items <@ ARRAY['pre_oil', 'shampoo', 'conditioner', 'deep_mask', 'protein_mask', 'clarifying']::TEXT[]),
    products    TEXT CHECK (char_length(products) <= 300),
    shedding    SMALLINT CHECK (shedding BETWEEN 1 AND 5),
    note        TEXT CHECK (char_length(note) <= 500),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- 4. Journal: private unless you tick "share with Lumi" on that entry
--    (only then can the evening review read it).
ALTER TABLE public.journal_entries ADD COLUMN IF NOT EXISTS share_with_lumi BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Books and notes per section (no books seeded).
CREATE TABLE IF NOT EXISTS public.books (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    author      TEXT CHECK (char_length(author) <= 200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.book_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    book_id     UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    section     TEXT NOT NULL CHECK (char_length(section) BETWEEN 1 AND 200),
    main_idea   TEXT CHECK (char_length(main_idea) <= 2000),
    experiment  TEXT CHECK (char_length(experiment) <= 2000),
    result      TEXT CHECK (char_length(result) <= 2000),
    note_date   DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS book_notes_book ON public.book_notes (user_id, book_id);

-- RLS: your own rows only.
ALTER TABLE public.care_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skin_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hair_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_notes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['care_steps', 'skin_logs', 'hair_logs', 'books', 'book_notes']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_own', t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', t || '_own', t);
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        END IF;
    END LOOP;
END;
$$;
