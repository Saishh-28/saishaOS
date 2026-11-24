-- =====================================================================
-- TEST PROJECT ONLY. Never run this in your real Supabase project.
--
-- Fake history for local testing: the last 10 days of habits, water,
-- skincare, a couple of workouts and meals, so the streak, XP, calendar
-- and trends have something to show.
--
-- 1. Run supabase_schema.sql in the test project first.
-- 2. Sign in to the local app once with your test account (the app adds
--    the plan, rewards, meal plan and skincare steps itself).
-- 3. Change the email below to your test account's, then run this file.
-- Safe to run again (it overwrites the same fake days).
-- =====================================================================
DO $$
DECLARE
    test_email TEXT := 'test@example.com';   -- <- your TEST account
    uid UUID;
    d DATE;
    i INT;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = test_email;
    IF uid IS NULL THEN
        RAISE EXCEPTION 'No user with email %. Sign in to the local app with your test account first.', test_email;
    END IF;

    FOR i IN 1..10 LOOP
        d := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - i;

        -- the day itself (an empty list; the app counts habits and water)
        INSERT INTO public.planner_days (user_id, date) VALUES (uid, d)
        ON CONFLICT (user_id, date) DO NOTHING;

        -- most habits on most days (skips a few so the streak has a forgiven miss)
        INSERT INTO public.habit_logs (user_id, date, habit_key, done)
        SELECT uid, d, k, (i % 4 <> 0)
        FROM UNNEST(ARRAY['walk', 'steps', 'walkLunch', 'walkDinner', 'protein', 'teach', 'read', 'phone']) AS k
        ON CONFLICT (user_id, date, habit_key) DO UPDATE SET done = EXCLUDED.done;

        -- gym on strength / cardio / yoga days (not Sunday)
        IF EXTRACT(DOW FROM d) <> 0 AND i % 4 <> 0 THEN
            INSERT INTO public.habit_logs (user_id, date, habit_key, done) VALUES (uid, d, 'gym', TRUE)
            ON CONFLICT (user_id, date, habit_key) DO UPDATE SET done = TRUE;
        END IF;

        -- water (ml) and skincare, in health_logs like the app writes them
        INSERT INTO public.health_logs (user_id, metric, value, unit, source, logged_at)
        VALUES
            (uid, 'water_ml', (1000 + (i % 3) * 250)::TEXT, 'ml', 'manual', (d::TEXT || 'T12:00:00Z')::TIMESTAMPTZ),
            (uid, 'skin_morning_done', (i % 4 <> 0)::TEXT, 'boolean', 'manual', (d::TEXT || 'T12:00:00Z')::TIMESTAMPTZ),
            (uid, 'skin_night_done', (i % 3 <> 0)::TEXT, 'boolean', 'manual', (d::TEXT || 'T12:00:00Z')::TIMESTAMPTZ)
        ON CONFLICT (user_id, metric, logged_at) DO UPDATE SET value = EXCLUDED.value;

        -- a skin rating every other day, a wash day every 4 days
        IF i % 2 = 0 THEN
            INSERT INTO public.skin_logs (user_id, date, rating, areas)
            VALUES (uid, d, 2 + (i % 4), CASE WHEN i % 6 = 0 THEN ARRAY['back'] ELSE '{}' END)
            ON CONFLICT (user_id, date) DO UPDATE SET rating = EXCLUDED.rating, areas = EXCLUDED.areas;
        END IF;
        IF i % 4 = 1 THEN
            INSERT INTO public.hair_logs (user_id, date, items, shedding)
            VALUES (uid, d, ARRAY['pre_oil', 'shampoo', 'conditioner'], 2 + (i % 2))
            ON CONFLICT (user_id, date) DO UPDATE SET items = EXCLUDED.items, shedding = EXCLUDED.shedding;
        END IF;

        -- breakfast and lunch as planned
        INSERT INTO public.meal_logs (user_id, date, slot, ate)
        VALUES (uid, d, 'breakfast', 'plan'), (uid, d, 'lunch', 'plan')
        ON CONFLICT (user_id, date, slot) DO NOTHING;
    END LOOP;
END;
$$;
