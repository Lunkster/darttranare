-- 04: Egna konton i en gemensam grupp (beslut Henrik 2026-11-22, vägval B)
--
-- Varje person har ett eget konto med rollen 'dart' i app_metadata och är kopplad till sin rad i spelare.
-- Alla i gruppen läser allt (topplista, kompisarnas statistik). Ett spel får bara ändras eller tas bort av
-- den som skapade det eller av en spelare i det. Spelare utan konto (gäster) är kvar som namn.
-- Konton skapas för hand i Supabase (ingen egen registrering); Claude sätter rollen och kopplar spelaren:
--   update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}') || '{"roll":"dart"}' where email = '…';
--   update dart.spelare set anvandare = (select id from auth.users where email = '…') where namn = '…';

alter table dart.spelare add column anvandare uuid unique references auth.users (id) on delete set null;
alter table dart.spel add column skapad_av uuid references auth.users (id) on delete set null;

-- Henriks konto är det som hittills var gemensamt
update dart.spelare set anvandare = (select id from auth.users where email = 'h.lundqvist+dart@gmail.com') where namn = 'Henrik';
update dart.spel set skapad_av = (select id from auth.users where email = 'h.lundqvist+dart@gmail.com') where skapad_av is null;

-- Får den inloggade ändra spelet? Nytt spel, eget spel eller spel där man själv är med.
create or replace function dart.far_andra(sid uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select dart.ar_dart() and auth.uid() is not null and (
    not exists (select 1 from dart.spel where id = sid)
    or exists (select 1 from dart.spel where id = sid and skapad_av = auth.uid())
    or exists (select 1 from dart.spel_spelare ss join dart.spelare sp on sp.id = ss.spelare_id
               where ss.spel_id = sid and sp.anvandare = auth.uid()))
$$;

-- Läsning: alla i gruppen. Skrivning i spelen: bara via spara_spel/ta_bort_spel, som kontrollerar far_andra.
drop policy dart_alla on dart.spel;
drop policy dart_alla on dart.spel_spelare;
drop policy dart_alla on dart.runda;
drop policy dart_alla on dart.pil;
drop policy dart_alla on dart.spelare;
create policy dart_las on dart.spel for select to authenticated using (dart.ar_dart());
create policy dart_las on dart.spel_spelare for select to authenticated using (dart.ar_dart());
create policy dart_las on dart.runda for select to authenticated using (dart.ar_dart());
create policy dart_las on dart.pil for select to authenticated using (dart.ar_dart());
create policy dart_las on dart.spelare for select to authenticated using (dart.ar_dart());
-- Spelare: alla får lägga till gäster; en spelare med konto ändras bara av ägaren. Ingen kopplar sig till någon annans konto.
create policy dart_ny on dart.spelare for insert to authenticated
  with check (dart.ar_dart() and (anvandare is null or anvandare = (select auth.uid())));
create policy dart_andra on dart.spelare for update to authenticated
  using (dart.ar_dart() and (anvandare is null or anvandare = (select auth.uid())))
  with check (dart.ar_dart() and (anvandare is null or anvandare = (select auth.uid())));
revoke insert, update, delete on dart.spel, dart.spel_spelare, dart.runda, dart.pil from authenticated;
revoke delete on dart.spelare from authenticated;

create or replace function dart.spara_spel(p jsonb) returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare sid uuid := (p ->> 'id')::uuid;
begin
  if not dart.far_andra(sid) then raise exception 'Ingen behörighet att ändra spelet'; end if;
  insert into dart.spel (id, typ, installningar, start, slut, match_id, kalla, anteckning, andrad, skapad_av)
  values (sid, p ->> 'typ', coalesce(p -> 'installningar', '{}'), (p ->> 'start')::timestamptz, (p ->> 'slut')::timestamptz,
          (p ->> 'match_id')::uuid, coalesce(p ->> 'kalla', 'app'), p ->> 'anteckning', now(), auth.uid())
  on conflict (id) do update set typ = excluded.typ, installningar = excluded.installningar, start = excluded.start,
    slut = excluded.slut, match_id = excluded.match_id, kalla = excluded.kalla, anteckning = excluded.anteckning, andrad = now();
  delete from dart.spel_spelare where spel_id = sid;   -- tar även rundor och pilar
  insert into dart.spel_spelare (spel_id, spelare_id, ordning, vinnare, resultat)
    select sid, x.spelare_id, x.ordning, coalesce(x.vinnare, false), x.resultat
    from jsonb_to_recordset(coalesce(p -> 'spelare', '[]')) as x(spelare_id smallint, ordning smallint, vinnare boolean, resultat jsonb);
  insert into dart.runda (spel_id, spelare_id, nr, poang, pilar, pilar_dubbel, checkout)
    select sid, x.spelare_id, x.nr, x.poang, coalesce(x.pilar, 3), coalesce(x.pilar_dubbel, 0), coalesce(x.checkout, false)
    from jsonb_to_recordset(coalesce(p -> 'rundor', '[]')) as x(spelare_id smallint, nr smallint, poang smallint, pilar smallint, pilar_dubbel smallint, checkout boolean);
  insert into dart.pil (spel_id, spelare_id, runda, nr, mal, segment)
    select sid, x.spelare_id, x.runda, x.nr, x.mal, x.segment
    from jsonb_to_recordset(coalesce(p -> 'pilar', '[]')) as x(spelare_id smallint, runda smallint, nr smallint, mal text, segment text);
  return sid;
end $$;

create or replace function dart.ta_bort_spel(sid uuid) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not dart.far_andra(sid) then raise exception 'Ingen behörighet att ta bort spelet'; end if;
  delete from dart.spel where id = sid;
end $$;

revoke execute on function dart.spara_spel(jsonb), dart.ta_bort_spel(uuid), dart.far_andra(uuid) from public, anon;
grant execute on function dart.spara_spel(jsonb), dart.ta_bort_spel(uuid), dart.far_andra(uuid) to authenticated;
