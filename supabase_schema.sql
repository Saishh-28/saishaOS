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
