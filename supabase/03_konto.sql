-- 03: Kontot får rollen dart (2026-11-22)
-- Kontot skapas av Henrik i Supabase: Authentication → Users → Add user → Create new user,
-- e-post h.lundqvist+dart@gmail.com, lösenord = koden (sparas i lösenordshanteraren), Auto Confirm User.
-- Kör sedan raden nedan. Golfens och skyttets konton påverkas inte och kan inte läsa dartdata.
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"roll":"dart"}'
  where email = 'h.lundqvist+dart@gmail.com';
