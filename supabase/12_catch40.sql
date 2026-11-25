-- 12: Catch 40 (önskemål 2026-11-25)
--
-- Utgångarna 61–100 i tur och ordning, högst 6 pilar per utgång.
-- En rad i dart.runda per utgång: nr = utgångens ordning (1–40, utgången = 60 + nr), poang = utgången om man gick ut annars 0,
-- pilar = pilar som gick åt (2–6; 6 om man inte gick ut), checkout = gick ut.
-- Poäng: ut på 2 pilar = 3, 3 pilar = 2, 4–6 pilar = 1, inte ut = 0. Räknas i v_resultat (som spel.js catchPoang) – inget lagras.
-- Bob's 27 på minus (samma dag) kräver ingen ändring här: poängen räknas som förut, appen slutar bara inte vid 0.

alter table dart.spel drop constraint spel_typ_check;
alter table dart.spel add constraint spel_typ_check check (typ in ('x01', 'bobs27', 'dubbelrunda', 'jdc', 'scoring', 'cricket', 'catch40'));

-- X01 har högst 3 pilar per besök; en utgång i Catch 40 upp till 6
alter table dart.runda drop constraint runda_pilar_check;
alter table dart.runda add constraint runda_pilar_check check (pilar between 1 and 6);

-- v_resultat: samma kolumner som i 11, Catch 40 hämtas ur runda (traffar = utgångar, rundor = utgångar spelade)
create or replace view dart.v_resultat with (security_invoker = true) as
select s.id as spel_id, ss.spelare_id, sp.namn, s.typ, s.start, s.slut, s.match_id, s.kalla, s.installningar, ss.vinnare,
       coalesce(sum(r.pilar), 0) + coalesce(max(c.pilar), 0) as pilar,
       coalesce(sum(r.traffar), 0) + coalesce(max(c.utgangar), 0) as traffar,
       coalesce(sum(r.marks), 0) as marks,
       coalesce(count(r.runda), 0) + coalesce((ss.resultat ->> 'rundor')::int, 0) + coalesce(max(c.rundor), 0) as rundor,
       case s.typ
         when 'bobs27' then 27 + coalesce(sum(case when r.traffar > 0 then r.traffar * 2 * r.mal_nummer else -2 * r.mal_nummer end), 0)
         when 'jdc' then coalesce(sum(case when r.mal ~ '^D' then 50 * r.traffar
                                           else r.mal_nummer * r.marks + case when r.shanghai then 100 else 0 end end), 0)
         when 'scoring' then coalesce(sum(r.poang_traff), 0)
         when 'catch40' then coalesce(max(c.poang), 0)
       end as poang,
       case when s.typ = 'cricket' then
         round((coalesce(sum(r.cricket_marks), 0) + coalesce((ss.resultat ->> 'marks')::int, 0)) * 1.0
               / nullif(coalesce(count(r.runda), 0) + coalesce((ss.resultat ->> 'rundor')::int, 0), 0), 2)
       end as mpr,
       coalesce(sum(r.singlar), 0) as singlar,
       coalesce(sum(r.dubblar), 0) as dubblar,
       coalesce(sum(r.tripplar), 0) as tripplar
from dart.spel s
join dart.spel_spelare ss on ss.spel_id = s.id
join dart.spelare sp on sp.id = ss.spelare_id
left join dart.v_runda_pil r on r.spel_id = s.id and r.spelare_id = ss.spelare_id
left join lateral (
  select count(*) as rundor, sum(x.pilar) as pilar, count(*) filter (where x.checkout) as utgangar,
         sum(case when not x.checkout then 0 when x.pilar <= 2 then 3 when x.pilar = 3 then 2 else 1 end) as poang
  from dart.runda x where x.spel_id = s.id and x.spelare_id = ss.spelare_id
) c on s.typ = 'catch40'
where s.typ <> 'x01'
group by s.id, ss.spelare_id, sp.namn, ss.vinnare, ss.resultat;
