-- 06: Man ser bara spel man själv var med i eller har skapat (beslut Henrik 2026-11-22)
--
-- Ersätter läsningen för alla i gruppen från 04. Spelarlistan är fortfarande synlig för alla i gruppen
-- (den behövs för att välja motståndare). Vyerna är security_invoker och följer med automatiskt.
-- Kommer senare: matcher i turneringar man själv är med i.

create or replace function dart.ser_spel(sid uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select dart.ar_dart() and auth.uid() is not null and (
    exists (select 1 from dart.spel where id = sid and skapad_av = auth.uid())
    or exists (select 1 from dart.spel_spelare ss join dart.spelare sp on sp.id = ss.spelare_id
               where ss.spel_id = sid and sp.anvandare = auth.uid()))
$$;
revoke execute on function dart.ser_spel(uuid) from public, anon;
grant execute on function dart.ser_spel(uuid) to authenticated;

drop policy dart_las on dart.spel;
drop policy dart_las on dart.spel_spelare;
drop policy dart_las on dart.runda;
drop policy dart_las on dart.pil;
create policy dart_las on dart.spel for select to authenticated using (dart.ser_spel(id));
create policy dart_las on dart.spel_spelare for select to authenticated using (dart.ser_spel(spel_id));
create policy dart_las on dart.runda for select to authenticated using (dart.ser_spel(spel_id));
create policy dart_las on dart.pil for select to authenticated using (dart.ser_spel(spel_id));
