-- 13: Admin ser alla spel (beslut Henrik 2026-11-25)
--
-- Övriga ser som förut bara spel de själva var med i, har skapat eller som hör till en turnering de är med i (06, 07).
-- Admin (app_metadata.dart_admin, Henriks konto) ser allt – historik och statistik för alla spelare.
-- Bara läsningen ändras: att ta bort och spara går som förut.

create or replace function dart.ser_spel(sid uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select dart.ar_dart() and auth.uid() is not null and (
    dart.ar_admin()
    or exists (select 1 from dart.spel where id = sid and skapad_av = auth.uid())
    or exists (select 1 from dart.spel_spelare ss join dart.spelare sp on sp.id = ss.spelare_id
               where ss.spel_id = sid and sp.anvandare = auth.uid())
    or exists (select 1 from dart.spel s join dart.turnering_match m on m.id = s.turnering_match
               where s.id = sid and dart.i_turnering(m.turnering_id)))
$$;
