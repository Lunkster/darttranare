-- 08: Spel på distans – två spelare i samma turneringsmatch, var och en på sin telefon (Henrik 2026-11-22)
--
-- Det pågående legets läge (samma objekt som appen har lokalt) delas i en rad per turneringsmatch.
-- Varje skrivning anger versionen den bygger på; är raden redan ändrad av motspelaren nekas den
-- och appen hämtar det nya läget. Raden är tillfällig: den tas bort när matchen är slut eller avbryts.
-- Färdiga legs sparas som vanligt med spara_spel – inget härlett lagras här.

create table dart.live_match (
  turnering_match  uuid primary key references dart.turnering_match on delete cascade,
  tillstand        jsonb not null,
  version          integer not null default 1,
  andrad           timestamptz not null default now(),
  andrad_av        uuid references auth.users (id) on delete set null
);

-- Är den inloggade en av matchens två spelare (eller admin)?
create or replace function dart.spelar_match(tm uuid) returns boolean
  language sql stable security definer set search_path = ''
  as $$
  select dart.ar_dart() and auth.uid() is not null and (dart.ar_admin() or exists (
    select 1 from dart.turnering_match m join dart.spelare sp on sp.id in (m.spelare1, m.spelare2)
    where m.id = tm and sp.anvandare = auth.uid())
    -- utslag: spelarna i senare rundor står inte i raden utan kommer från tidigare matcher
    or exists (select 1 from dart.live_match l join dart.spelare sp on sp.anvandare = auth.uid()
               where l.turnering_match = tm and (l.tillstand -> 'spelare') @> to_jsonb(sp.id)))
$$;

alter table dart.live_match enable row level security;
create policy dart_las on dart.live_match for select to authenticated using (
  dart.ar_dart() and exists (select 1 from dart.turnering_match m where m.id = turnering_match and dart.i_turnering(m.turnering_id)));
grant select on dart.live_match to authenticated;

-- ver = 0: starta (nekas om matchen redan är startad). Annars: ver måste vara den senaste versionen.
-- Svar: nya versionen, eller null om någon annan hann före.
create or replace function dart.live_skicka(tm uuid, ver integer, lage jsonb) returns integer
  language plpgsql security definer set search_path = ''
  as $$
declare ny integer;
        m dart.turnering_match;
begin
  select * into m from dart.turnering_match where id = tm;
  if m.id is null or not dart.i_turnering(m.turnering_id) then raise exception 'Ingen behörighet i turneringen'; end if;
  if ver = 0 then
    -- den som startar ska vara en av spelarna, och spelarna ska vara matchens (när de redan står i schemat)
    if not (dart.ar_admin() or exists (select 1 from dart.spelare sp where sp.anvandare = auth.uid()
                                       and (lage -> 'spelare') @> to_jsonb(sp.id))) then
      raise exception 'Bara matchens spelare kan spela på distans';
    end if;
    if m.spelare1 is not null and m.spelare2 is not null
       and not (lage -> 'spelare') @> jsonb_build_array(m.spelare1, m.spelare2) then
      raise exception 'Fel spelare för matchen';
    end if;
    insert into dart.live_match (turnering_match, tillstand, andrad_av) values (tm, lage, auth.uid())
      on conflict (turnering_match) do nothing returning version into ny;
  else
    if not dart.spelar_match(tm) then raise exception 'Bara matchens spelare kan spela på distans'; end if;
    update dart.live_match l set tillstand = lage, version = l.version + 1, andrad = now(), andrad_av = auth.uid()
      where l.turnering_match = tm and l.version = ver
      returning l.version into ny;
  end if;
  return ny;
end $$;

create or replace function dart.live_avsluta(tm uuid) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not dart.spelar_match(tm) then raise exception 'Bara matchens spelare kan avsluta'; end if;
  delete from dart.live_match where turnering_match = tm;
end $$;

revoke execute on function dart.live_skicka(uuid, integer, jsonb), dart.live_avsluta(uuid), dart.spelar_match(uuid) from public, anon;
grant execute on function dart.live_skicka(uuid, integer, jsonb), dart.live_avsluta(uuid), dart.spelar_match(uuid) to authenticated;
