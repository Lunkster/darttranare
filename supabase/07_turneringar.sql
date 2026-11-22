-- 07: Turneringar (beslut Henrik 2026-11-22)
--
-- Format serie (alla möter alla, ev. två gånger) eller utslag. Spelform X01 eller cricket, först till N legs.
-- Deltagare är spelare med konto eller gäster. Bara admin (Henrik) skapar turneringar – app_metadata.dart_admin.
-- Deltagare med konto ser alla matcher i turneringen, men inte deltagarnas övriga spel.
-- Varje leg är ett vanligt spel med spel.turnering_match satt. Matchresultat och tabell räknas ur legsen (lagras inte).

create or replace function dart.ar_admin() returns boolean
  language sql stable set search_path = ''
  as $$ select dart.ar_dart() and coalesce((auth.jwt() -> 'app_metadata' ->> 'dart_admin')::boolean, false) $$;

create table dart.turnering (
  id             uuid primary key default gen_random_uuid(),
  namn           text not null check (length(namn) between 1 and 60),
  format         text not null check (format in ('serie', 'utslag')),
  typ            text not null check (typ in ('x01', 'cricket')),
  installningar  jsonb not null default '{}',      -- {"start":501,"forst_till":3,"dubbelmote":false}
  skapad         timestamptz not null default now(),
  skapad_av      uuid references auth.users (id) on delete set null,
  avslutad       timestamptz
);

create table dart.turnering_deltagare (
  turnering_id  uuid not null references dart.turnering on delete cascade,
  spelare_id    smallint not null references dart.spelare,
  seed          smallint not null,
  primary key (turnering_id, spelare_id)
);

-- Spelschemat. Utslag: spelare1/2 tomma i senare rundor – fran1/fran2 pekar på matchen vars vinnare går vidare.
-- En match utan motståndare och utan fran är en walk over.
create table dart.turnering_match (
  id            uuid primary key,
  turnering_id  uuid not null references dart.turnering on delete cascade,
  runda         smallint not null,
  nr            smallint not null,
  spelare1      smallint references dart.spelare,
  spelare2      smallint references dart.spelare,
  fran1         uuid references dart.turnering_match on delete cascade,
  fran2         uuid references dart.turnering_match on delete cascade,
  unique (turnering_id, runda, nr)
);

alter table dart.spel add column turnering_match uuid references dart.turnering_match on delete set null;
create index on dart.spel (turnering_match);

-- Är den inloggade med i turneringen (eller admin)?
create or replace function dart.i_turnering(tid uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select dart.ar_admin() or exists (
    select 1 from dart.turnering_deltagare d join dart.spelare sp on sp.id = d.spelare_id
    where d.turnering_id = tid and sp.anvandare = auth.uid())
$$;

alter table dart.turnering enable row level security;
alter table dart.turnering_deltagare enable row level security;
alter table dart.turnering_match enable row level security;
create policy dart_las on dart.turnering for select to authenticated using (dart.ar_dart() and dart.i_turnering(id));
create policy dart_las on dart.turnering_deltagare for select to authenticated using (dart.ar_dart() and dart.i_turnering(turnering_id));
create policy dart_las on dart.turnering_match for select to authenticated using (dart.ar_dart() and dart.i_turnering(turnering_id));
grant select on dart.turnering, dart.turnering_deltagare, dart.turnering_match to authenticated;

-- Spel: man ser också legs i turneringar man är med i
create or replace function dart.ser_spel(sid uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select dart.ar_dart() and auth.uid() is not null and (
    exists (select 1 from dart.spel where id = sid and skapad_av = auth.uid())
    or exists (select 1 from dart.spel_spelare ss join dart.spelare sp on sp.id = ss.spelare_id
               where ss.spel_id = sid and sp.anvandare = auth.uid())
    or exists (select 1 from dart.spel s join dart.turnering_match m on m.id = s.turnering_match
               where s.id = sid and dart.i_turnering(m.turnering_id)))
$$;

-- Ändra: som förut, och admin får rätta turneringsmatcher
create or replace function dart.far_andra(sid uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select dart.ar_dart() and auth.uid() is not null and (
    not exists (select 1 from dart.spel where id = sid)
    or exists (select 1 from dart.spel where id = sid and skapad_av = auth.uid())
    or exists (select 1 from dart.spel_spelare ss join dart.spelare sp on sp.id = ss.spelare_id
               where ss.spel_id = sid and sp.anvandare = auth.uid())
    or (dart.ar_admin() and exists (select 1 from dart.spel where id = sid and turnering_match is not null)))
$$;

create or replace function dart.spara_spel(p jsonb) returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare sid uuid := (p ->> 'id')::uuid;
        tm uuid := (p ->> 'turnering_match')::uuid;
begin
  if not dart.far_andra(sid) then raise exception 'Ingen behörighet att ändra spelet'; end if;
  if tm is not null and not exists (select 1 from dart.turnering_match m where m.id = tm and dart.i_turnering(m.turnering_id)) then
    raise exception 'Ingen behörighet i turneringen';
  end if;
  insert into dart.spel (id, typ, installningar, start, slut, match_id, kalla, anteckning, andrad, skapad_av, turnering_match)
  values (sid, p ->> 'typ', coalesce(p -> 'installningar', '{}'), (p ->> 'start')::timestamptz, (p ->> 'slut')::timestamptz,
          (p ->> 'match_id')::uuid, coalesce(p ->> 'kalla', 'app'), p ->> 'anteckning', now(), auth.uid(), tm)
  on conflict (id) do update set typ = excluded.typ, installningar = excluded.installningar, start = excluded.start,
    slut = excluded.slut, match_id = excluded.match_id, kalla = excluded.kalla, anteckning = excluded.anteckning, andrad = now(),
    turnering_match = excluded.turnering_match;
  delete from dart.spel_spelare where spel_id = sid;
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

-- Skapa en turnering med deltagare och spelschema (schemat görs i appen, spel.js) – bara admin
-- p = {namn, format, typ, installningar, deltagare:[{spelare_id,seed}], matcher:[{id,runda,nr,spelare1,spelare2,fran1,fran2}]}
create or replace function dart.skapa_turnering(p jsonb) returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare tid uuid := gen_random_uuid();
begin
  if not dart.ar_admin() then raise exception 'Bara admin kan skapa turneringar'; end if;
  insert into dart.turnering (id, namn, format, typ, installningar, skapad_av)
  values (tid, p ->> 'namn', p ->> 'format', p ->> 'typ', coalesce(p -> 'installningar', '{}'), auth.uid());
  insert into dart.turnering_deltagare (turnering_id, spelare_id, seed)
    select tid, x.spelare_id, x.seed from jsonb_to_recordset(p -> 'deltagare') as x(spelare_id smallint, seed smallint);
  -- matcher utan fran först, så att referenserna finns
  insert into dart.turnering_match (id, turnering_id, runda, nr, spelare1, spelare2, fran1, fran2)
    select x.id, tid, x.runda, x.nr, x.spelare1, x.spelare2, x.fran1, x.fran2
    from jsonb_to_recordset(p -> 'matcher') as x(id uuid, runda smallint, nr smallint, spelare1 smallint, spelare2 smallint, fran1 uuid, fran2 uuid)
    order by x.runda;
  return tid;
end $$;

create or replace function dart.ta_bort_turnering(tid uuid) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not dart.ar_admin() then raise exception 'Bara admin kan ta bort turneringar'; end if;
  delete from dart.turnering where id = tid;   -- legsen finns kvar som vanliga spel
end $$;

revoke execute on function dart.skapa_turnering(jsonb), dart.ta_bort_turnering(uuid), dart.i_turnering(uuid) from public, anon;
grant execute on function dart.skapa_turnering(jsonb), dart.ta_bort_turnering(uuid), dart.i_turnering(uuid), dart.ar_admin() to authenticated;

-- Per turneringsmatch och spelare: legs, vunna legs, poäng och pilar (X01), marks och rundor (cricket)
create or replace view dart.v_turnering_leg with (security_invoker = true) as
select s.turnering_match, m.turnering_id, ss.spelare_id,
       count(*) as legs, count(*) filter (where ss.vinnare) as vunna,
       coalesce(sum(x.poang), 0) as poang, coalesce(sum(x.pilar), 0) as pilar,
       coalesce(sum(c.marks), 0) as marks, coalesce(sum(c.rundor), 0) as rundor
from dart.spel s
join dart.turnering_match m on m.id = s.turnering_match
join dart.spel_spelare ss on ss.spel_id = s.id
left join lateral (select sum(r.poang) as poang, sum(r.pilar) as pilar from dart.runda r
                   where r.spel_id = s.id and r.spelare_id = ss.spelare_id) x on true
left join lateral (select sum(v.cricket_marks) as marks, count(*) as rundor from dart.v_runda_pil v
                   where v.spel_id = s.id and v.spelare_id = ss.spelare_id) c on true
where s.slut is not null
group by s.turnering_match, m.turnering_id, ss.spelare_id;
grant select on dart.v_turnering_leg to authenticated;
