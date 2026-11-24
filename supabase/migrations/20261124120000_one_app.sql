-- =====================================================================
-- Part D: one app (planner + old dashboard)
-- Safe to run more than once. Deletes nothing except exact duplicate
-- journal entries (same user, same day; none exist today).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. journal_entries: one entry per user per day.
--    The old dashboard gave each entry an ID made from the date only
--    (toUUID("journal-" + date)), so two accounts writing on the same day
--    could overwrite each other. From now on a journal entry is matched on
--    (user_id, entry_date) and the database picks the id.
--    Keep the most recently updated entry if a day somehow has two.
-- ---------------------------------------------------------------------
DELETE FROM public.journal_entries a
USING public.journal_entries b
WHERE a.user_id = b.user_id
  AND a.entry_date = b.entry_date
  AND (a.updated_at, a.id) < (b.updated_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_user_entry_date_key
    ON public.journal_entries (user_id, entry_date);

-- ---------------------------------------------------------------------
-- 2. courses: which semester, and the final grade once it's out.
-- ---------------------------------------------------------------------
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS term TEXT
    CHECK (term ~ '^(S1|S2|SS) \d{4}$');
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS final_grade TEXT
    CHECK (final_grade ~ '^([A-D][+-]?|E|DNS|DNC|CPL|P)$');

-- ---------------------------------------------------------------------
-- 3. Live sync for the screens that move into the planner.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['profiles', 'settings', 'courses', 'assignments', 'career_projects', 'journal_entries',
                             'songs', 'song_versions', 'budgets', 'budget_categories', 'transactions', 'bucket_list',
                             'chat_sessions', 'chat_messages']
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

-- Check (optional): SELECT user_id, entry_date, count(*) FROM public.journal_entries GROUP BY 1, 2 HAVING count(*) > 1;
