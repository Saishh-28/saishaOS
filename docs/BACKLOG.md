# Backlog

Things to do later, in no fixed order. Move an item into a PR when it's picked up.

## Separate Supabase project for local development

Today `npm run dev` talks to the real Supabase project, so local testing (and the
dev-only `?date=` override) writes real data.

- Create a second Supabase project ("saishaOS-dev") and run `supabase_schema.sql` in it.
- Put its URL and anon key in `.env.local` / `.dev.vars` for local runs only; the live
  site keeps the real project. Document both in `.env.example` (no values).
- Make the dev server refuse to start against the real project URL unless explicitly
  allowed, so a wrong `.env` can't touch real data.
- Seed script with a test user and a few days of fake history.

## Remove the old dashboard

After the Music Room, Treasury, Lumi chat and Courses have been checked on the phone:
delete `App.tsx`, the old components, `/classic` and the legacy `/api/saisha/interact`
route in one PR (it stays in git history).
