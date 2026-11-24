-- =====================================================================
-- Saisha OS Finalized Relational Database Schema (Next 5-10 Years Scale)
-- Optimized for Supabase PostgreSQL, Flutter, AI Capabilities & Sync
-- =====================================================================

-- Enable necessary PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector"; -- Safe fallback for vector-based AI memories if pre-installed

-- =====================================================================
-- 1. PROFILES & USER IDENTITY
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    current_focus TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 2. SYSTEM SETTINGS & DEVICES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    ai_personality TEXT DEFAULT 'jarvis',
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{}'::jsonb,
    widget_settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'ios', 'android', 'web', 'macos', 'windows'
    push_token TEXT,
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    timezone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 3. ACADEMICS & UNIVERSITY
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- e.g., 'STATS 101'
    name TEXT NOT NULL, -- e.g., 'Statistical Analysis'
    professor TEXT,
    credits INTEGER DEFAULT 15,
    grade_goal TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    weight NUMERIC NOT NULL, -- percentage of overall grade
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
    score NUMERIC,
    max_score NUMERIC,
    weight_achieved NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lecture_date TIMESTAMPTZ NOT NULL,
    summary TEXT,
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 4. CAREER & PORTFOLIO
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.career_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog', -- 'backlog', 'in-progress', 'completed'
    github_repository TEXT,
    demo_url TEXT,
    technologies TEXT[],
    difficulty TEXT, -- 'easy', 'medium', 'hard'
    estimated_hours NUMERIC,
    actual_hours NUMERIC,
    reflection TEXT,
    completed_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.career_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'languages', 'frameworks', 'tools', 'soft'
    proficiency_score INTEGER CHECK (proficiency_score BETWEEN 1 AND 10),
    target_date TIMESTAMPTZ,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 5. DAILY RITUALS, HEALTH & JOURNAL
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.rituals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    time_of_day TEXT NOT NULL, -- 'morning', 'afternoon', 'night'
    completed BOOLEAN DEFAULT FALSE,
    category TEXT NOT NULL, -- 'health', 'fitness', 'mind', 'academic', 'creativity'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric TEXT NOT NULL, -- 'steps', 'sleep_hours', 'water_cups', 'hair_oiled', 'hair_dermarolled', 'mood', etc.
    value TEXT NOT NULL, -- stored as text for ultimate schema-less flexibility
    unit TEXT, -- 'count', 'hours', 'cups', 'boolean', 'score', etc.
    source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'health_connect', 'healthkit', 'smartwatch', 'imported'
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    prompt TEXT,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general', -- 'general', 'travel', 'dream', 'reflection', 'poetry', 'future_letter'
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
    entry_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 6. SONGWRITING STUDIO & VERSIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'spark', -- 'spark', 'wip', 'completed'
    key TEXT,
    tempo TEXT,
    chords TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.song_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    lyrics TEXT NOT NULL,
    audio_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 7. LEDGER & FINANCIALS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    savings_goal NUMERIC NOT NULL DEFAULT 0,
    current_savings NUMERIC NOT NULL DEFAULT 0,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    budgeted_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.budget_categories(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    description TEXT,
    transaction_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 8. TIMELINE & BUCKET LIST
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.bucket_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    completed BOOLEAN DEFAULT FALSE,
    completed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    category TEXT NOT NULL, -- 'academic', 'career', 'life', 'creative', 'health'
    importance INTEGER CHECK (importance BETWEEN 1 AND 5) DEFAULT 3, -- 1 (small) to 5 (life-changing)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 9. CHAT, MEMORY & INTELLECTUAL AI
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    ai_personality TEXT NOT NULL DEFAULT 'jarvis', -- 'jarvis', 'study', 'songwriter', 'wellness'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    sender TEXT NOT NULL, -- 'user', 'assistant'
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'preference', 'goal', 'history', 'insight'
    fact TEXT NOT NULL,
    confidence NUMERIC CHECK (confidence BETWEEN 0.0 AND 1.0) DEFAULT 1.0,
    importance INTEGER CHECK (importance BETWEEN 1 AND 5) DEFAULT 3,
    source TEXT NOT NULL DEFAULT 'chat', -- 'chat', 'direct_input', 'analysis'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL, -- 'academic', 'career', 'health', 'financial', 'creative'
    priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'suggested', -- 'suggested', 'accepted', 'ignored'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    prediction_type TEXT NOT NULL,
    target_date DATE NOT NULL,
    confidence NUMERIC CHECK (confidence BETWEEN 0.0 AND 1.0),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 10. ATTACHMENTS, GITHUB & NOTIFICATIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    bucket_name TEXT NOT NULL DEFAULT 'saisha_vault',
    storage_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    checksum TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'reminder', -- 'reminder', 'alert', 'achievement', 'system'
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    scheduled_for TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.github_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    access_token TEXT, -- securely isolated via RLS / backend proxying
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_github UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    github_account_id UUID NOT NULL REFERENCES public.github_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    html_url TEXT,
    description TEXT,
    language TEXT,
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    message TEXT NOT NULL,
    commit_date TIMESTAMPTZ NOT NULL,
    author_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    badge_icon TEXT, -- Lucide icon reference string
    points INTEGER DEFAULT 10,
    unlocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 11. GENERIC RELATIONSHIP LINKING SYSTEM (THE GRAPH CONNECTOR)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.entity_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL, -- 'journal_entries', 'timeline_events', 'courses', 'songs', 'memories', etc.
    source_id UUID NOT NULL,
    target_type TEXT NOT NULL, -- 'songs', 'attachments', 'journal_entries', 'assignments', etc.
    target_id UUID NOT NULL,
    relationship_type TEXT NOT NULL, -- 'inspires', 'references', 'supports', 'derived_from'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- II. AUTOMATIC TRIGGER FOR UPDATED_AT COLUMNS
-- =====================================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply modified column triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'profiles', 'settings', 'devices', 'courses', 'assignments', 
            'grades', 'lectures', 'career_projects', 'career_skills', 
            'rituals', 'health_logs', 'journal_entries', 'songs', 
            'song_versions', 'budgets', 'budget_categories', 'transactions', 
            'bucket_list', 'timeline_events', 'chat_sessions', 'memories', 'ai_insights', 
            'ai_tasks', 'ai_predictions', 'attachments', 'notifications', 
            'github_accounts', 'repositories', 'commits', 'achievements', 'entity_links'
          )
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_modtime ON public.%I;
            CREATE TRIGGER update_%I_modtime
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();', t, t, t, t);
    END LOOP;
END;
$$;

-- =====================================================================
-- III. INDEXES FOR OUTSTANDING QUERY PERFORMANCE & FLUTTER SYNC
-- =====================================================================

-- Identity & Settings
CREATE INDEX IF NOT EXISTS idx_settings_user ON public.settings(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON public.devices(user_id);

-- Academics & Portfolio
CREATE INDEX IF NOT EXISTS idx_courses_user ON public.courses(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_grades_course ON public.grades(course_id);
CREATE INDEX IF NOT EXISTS idx_lectures_course ON public.lectures(course_id);
CREATE INDEX IF NOT EXISTS idx_career_projects_user ON public.career_projects(user_id);

-- Health, Rituals & Journaling
CREATE INDEX IF NOT EXISTS idx_rituals_user ON public.rituals(user_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_user_metric ON public.health_logs(user_id, metric);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date ON public.journal_entries(user_id, entry_date);

-- Songs & Financials
CREATE INDEX IF NOT EXISTS idx_songs_user ON public.songs(user_id);
CREATE INDEX IF NOT EXISTS idx_song_versions_song ON public.song_versions(song_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_budget ON public.budget_categories(budget_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);

-- Timeline & Graph connections
CREATE INDEX IF NOT EXISTS idx_timeline_events_user_date ON public.timeline_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_entity_links_source ON public.entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON public.entity_links(target_type, target_id);

-- AI Layers & Chat
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_user ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON public.ai_insights(user_id);

-- GitHub, Achievements & Attachments
CREATE INDEX IF NOT EXISTS idx_repositories_account ON public.repositories(github_account_id);
CREATE INDEX IF NOT EXISTS idx_commits_repository ON public.commits(repository_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user ON public.attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = FALSE;

-- =====================================================================
-- IV. ROW LEVEL SECURITY (RLS) POLICIES FOR TOTAL PRIVACY & ISOLATION
-- =====================================================================

-- Helper: Enable RLS on all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'profiles', 'settings', 'devices', 'courses', 'assignments', 
            'grades', 'lectures', 'career_projects', 'career_skills', 
            'rituals', 'health_logs', 'journal_entries', 'songs', 
            'song_versions', 'budgets', 'budget_categories', 'transactions', 
            'bucket_list', 'timeline_events', 'chat_sessions', 'chat_messages', 'memories', 'ai_insights', 
            'ai_tasks', 'ai_predictions', 'attachments', 'notifications', 
            'github_accounts', 'repositories', 'commits', 'achievements', 'entity_links'
          )
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END;
$$;

-- Generic definition generator for policy (User Isolation)
-- To prevent syntax collisions, we drop and rebuild them cleanly:
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'profiles', 'settings', 'devices', 'courses', 'assignments', 
            'grades', 'lectures', 'career_projects', 'career_skills', 
            'rituals', 'health_logs', 'journal_entries', 'songs', 
            'song_versions', 'budgets', 'budget_categories', 'transactions', 
            'bucket_list', 'timeline_events', 'chat_sessions', 'chat_messages', 'memories', 'ai_insights', 
            'ai_tasks', 'ai_predictions', 'attachments', 'notifications', 
            'github_accounts', 'repositories', 'commits', 'achievements', 'entity_links'
          )
    LOOP
        -- Safely drop existing user-isolation policy first
        EXECUTE format('DROP POLICY IF EXISTS %I_isolation_policy ON public.%I;', t, t);
        
        -- Profiles behaves as insert/select/update on self
        IF t = 'profiles' THEN
            EXECUTE 'CREATE POLICY profiles_isolation_policy ON public.profiles FOR ALL USING (auth.uid() = id);';
        ELSE
            EXECUTE format('CREATE POLICY %I_isolation_policy ON public.%I FOR ALL USING (auth.uid() = user_id);', t, t);
        END IF;
    END LOOP;
END;
$$;


-- =====================================================================
-- V. DAILY PLANNER
-- Kept identical to supabase/migrations/20261119000000_daily_planner.sql
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

-- =====================================================================
-- VI. GYM LOGS + LIVE SYNC
-- Same as supabase/migrations/20261119120000_exercise_logs_realtime.sql
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

-- =====================================================================
-- VII. WORKOUT PLANS (exercise swaps)
-- Same as supabase/migrations/20261120120000_workout_plans.sql
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

-- =====================================================================
-- VIII. WATER IN ML, PER-USER HEALTH LOG KEYS, USER SETTINGS
-- Same as supabase/migrations/20261120180000_water_ml_settings.sql

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

-- =====================================================================
-- IX. ONE APP: per-user journal keys, course terms and grades, live sync
-- Same as supabase/migrations/20261124120000_one_app.sql

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
