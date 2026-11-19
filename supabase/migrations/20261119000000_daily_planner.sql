-- =====================================================================
-- Saisha OS: Daily Planner (migration 2026-11-19)
-- Safe to run more than once in the Supabase SQL editor.
--
-- Water and skincare AM/PM are NOT stored here: the planner reuses the
-- existing public.health_logs rows Sanctuary writes (metrics water_cups,
-- skin_morning_done, skin_night_done), so both screens share one value.
-- =====================================================================

-- Shared updated_at trigger function (also defined in supabase_schema.sql)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- plan_tasks: the plan queue (seeded from src/planner/plan.ts by the app)
-- plus custom tasks added by hand or by the AI review.
-- IDs such as 'deep-2026-11-23-4' are unique per user, not globally.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_tasks (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    id TEXT NOT NULL CHECK (char_length(id) BETWEEN 1 AND 100),
    block TEXT NOT NULL CHECK (block IN ('deep', 'study')),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    phase_start DATE NOT NULL,
    sort_order INTEGER NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    is_ai BOOLEAN NOT NULL DEFAULT FALSE, -- suggested by the AI review (shown with ✨)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, id),
    -- lets daily_list_items enforce that a task is listed under its own block
    UNIQUE (user_id, id, block)
);

-- ---------------------------------------------------------------------
-- planner_days: one row per day that has been opened. Its existence means
-- "this day's lists were already created", so an emptied list is not refilled.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planner_days (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    from_ai BOOLEAN NOT NULL DEFAULT FALSE, -- lists came from an approved AI review
    notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

-- ---------------------------------------------------------------------
-- daily_list_items: the deep/study to-do list for a day
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_list_items (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    block TEXT NOT NULL CHECK (block IN ('deep', 'study')),
    task_id TEXT NOT NULL,
    carried_over BOOLEAN NOT NULL DEFAULT FALSE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date, task_id),
    FOREIGN KEY (user_id, date) REFERENCES public.planner_days(user_id, date) ON DELETE CASCADE,
    FOREIGN KEY (user_id, task_id, block) REFERENCES public.plan_tasks(user_id, id, block) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- task_completions: a task is done once, on done_date
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_completions (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    done_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, task_id),
    FOREIGN KEY (user_id, task_id) REFERENCES public.plan_tasks(user_id, id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- habit_logs: habits with no existing home (gym, walk, steps, protein,
-- teach, read, phone) and gym exercise ticks (habit_key 'gym:A:0').
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.habit_logs (
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    habit_key TEXT NOT NULL CHECK (habit_key ~ '^[A-Za-z0-9:_-]{1,40}$'),
    done BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date, habit_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plan_tasks_user_block ON public.plan_tasks(user_id, block, sort_order);
CREATE INDEX IF NOT EXISTS idx_daily_list_items_user_date ON public.daily_list_items(user_id, date);
CREATE INDEX IF NOT EXISTS idx_task_completions_user_date ON public.task_completions(user_id, done_date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public.habit_logs(user_id, date);

-- updated_at triggers + Row Level Security (users only see their own rows)
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['plan_tasks', 'planner_days', 'daily_list_items', 'task_completions', 'habit_logs']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_modtime ON public.%I;', t, t);
        EXECUTE format('CREATE TRIGGER update_%I_modtime BEFORE UPDATE ON public.%I
                        FOR EACH ROW EXECUTE FUNCTION update_modified_column();', t, t);

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS %I_isolation_policy ON public.%I;', t, t);
        EXECUTE format('CREATE POLICY %I_isolation_policy ON public.%I FOR ALL TO authenticated
                        USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', t, t);
    END LOOP;
END;
$$;
