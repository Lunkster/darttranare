-- 10: Löpande serie och set (önskemål 2026-11-23)
--
-- Löpande serie: två spelare möts i 10, 20 eller 30 matcher i tur och ordning, den som börjar växlar.
-- Set: installningar.set = antal set för att vinna matchen (1 = inga set), forst_till = legs per set.
-- Setställningen räknas i appen genom att gå igenom legsen i tidsordning (vyn v_turnering_legvinst) – inget lagras.
-- En löpande serie får skapas av vem som helst med konto, om man själv är en av de två. Övriga format: bara admin.

alter table dart.turnering drop constraint turnering_format_check;
alter table dart.turnering add constraint turnering_format_check check (format in ('serie', 'utslag', 'lopande'));

-- Vem vann varje färdigt leg i en turneringsmatch, i tidsordning
create or replace view dart.v_turnering_legvinst with (security_invoker = true) as
select s.turnering_match, s.id as spel_id, s.start, ss.spelare_id as vinnare
from dart.spel s
join dart.spel_spelare ss on ss.spel_id = s.id and ss.vinnare
where s.turnering_match is not null and s.slut is not null;
grant select on dart.v_turnering_legvinst to authenticated;

create or replace function dart.skapa_turnering(p jsonb) returns uuid
  language plpgsql security definer set search_path = ''
  as $$
declare tid uuid := gen_random_uuid();
begin
  if not dart.ar_admin() then
    -- löpande serie: man är själv en av exakt två deltagare
    if not (dart.ar_dart() and p ->> 'format' = 'lopande' and jsonb_array_length(p -> 'deltagare') = 2
            and exists (select 1 from jsonb_to_recordset(p -> 'deltagare') as x(spelare_id smallint, seed smallint)
                        join dart.spelare sp on sp.id = x.spelare_id where sp.anvandare = auth.uid())) then
      raise exception 'Bara admin kan skapa turneringar – en löpande serie kan du skapa om du själv är med';
    end if;
  end if;
  insert into dart.turnering (id, namn, format, typ, installningar, skapad_av)
  values (tid, p ->> 'namn', p ->> 'format', p ->> 'typ', coalesce(p -> 'installningar', '{}'), auth.uid());
  insert into dart.turnering_deltagare (turnering_id, spelare_id, seed)
    select tid, x.spelare_id, x.seed from jsonb_to_recordset(p -> 'deltagare') as x(spelare_id smallint, seed smallint);
  insert into dart.turnering_match (id, turnering_id, runda, nr, spelare1, spelare2, fran1, fran2)
    select x.id, tid, x.runda, x.nr, x.spelare1, x.spelare2, x.fran1, x.fran2
    from jsonb_to_recordset(p -> 'matcher') as x(id uuid, runda smallint, nr smallint, spelare1 smallint, spelare2 smallint, fran1 uuid, fran2 uuid)
    order by x.runda;
  return tid;
end $$;

-- Ta bort: admin, eller den som skapade turneringen
create or replace function dart.ta_bort_turnering(tid uuid) returns void
  language plpgsql security definer set search_path = ''
  as $$
begin
  if not (dart.ar_admin() or (dart.ar_dart() and exists (select 1 from dart.turnering where id = tid and skapad_av = auth.uid()))) then
    raise exception 'Bara admin eller den som skapade turneringen kan ta bort den';
  end if;
  delete from dart.turnering where id = tid;   -- legsen finns kvar som vanliga spel
end $$;
