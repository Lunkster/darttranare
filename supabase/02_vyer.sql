-- 02: Vyer – all statistik räknas här ur rundor och pilar (2026-11-22)
-- security_invoker: vyerna följer tabellernas Row Level Security.

-- Varje pil med tolkat segment och om den träffade det man siktade på
create or replace view dart.v_pil with (security_invoker = true) as
select x.*,
       (x.mal_nummer is not null and x.nummer = x.mal_nummer and (x.mal_mult is null or x.mult = x.mal_mult)) as traff
from (
  select p.spel_id, p.spelare_id, p.runda, p.nr, p.mal, p.segment, s.typ, s.start,
         case when p.segment = 'M' then 0 else substr(p.segment, 2)::int end as nummer,
         case left(p.segment, 1) when 'S' then 1 when 'D' then 2 when 'T' then 3 else 0 end as mult,
         nullif(regexp_replace(p.mal, '^[DT]', ''), '')::int as mal_nummer,
         case left(p.mal, 1) when 'D' then 2 when 'T' then 3 end as mal_mult
  from dart.pil p join dart.spel s on s.id = p.spel_id
) x;

-- Per runda (upp till 3 pilar)
create or replace view dart.v_runda_pil with (security_invoker = true) as
select spel_id, spelare_id, runda, typ, min(mal) as mal, min(mal_nummer) as mal_nummer,
       count(*) as pilar,
       count(*) filter (where traff) as traffar,
       coalesce(sum(mult) filter (where traff), 0) as marks,
       coalesce(sum(nummer * mult) filter (where traff), 0) as poang_traff,
       coalesce(sum(mult) filter (where nummer between 15 and 20 or nummer = 25), 0) as cricket_marks,
       (bool_or(traff and mult = 1) and bool_or(traff and mult = 2) and bool_or(traff and mult = 3)) as shanghai
from dart.v_pil
group by spel_id, spelare_id, runda, typ;

-- X01 per spel och spelare
create or replace view dart.v_x01 with (security_invoker = true) as
select s.id as spel_id, ss.spelare_id, sp.namn, s.start, s.slut, s.match_id, s.kalla,
       (s.installningar ->> 'start')::int as startpoang, ss.vinnare, ss.resultat ->> 'mot' as mot,
       coalesce(sum(r.poang), 0) as poang,
       coalesce(sum(r.pilar), 0) as pilar,
       round(sum(r.poang) * 3.0 / nullif(sum(r.pilar), 0), 2) as snitt,
       round(sum(r.poang) filter (where r.nr <= 3) * 3.0 / nullif(sum(r.pilar) filter (where r.nr <= 3), 0), 2) as snitt_forsta9,
       coalesce(sum(r.pilar_dubbel), 0) as pilar_dubbel,
       count(r.*) filter (where r.checkout) as checkouts,
       max(r.poang) filter (where r.checkout) as utgang,
       count(r.*) filter (where r.poang >= 100) as plus100,
       count(r.*) filter (where r.poang >= 140) as plus140,
       count(r.*) filter (where r.poang = 180) as maxar,
       (s.installningar ->> 'start')::int - coalesce(sum(r.poang), 0) as kvar
from dart.spel s
join dart.spel_spelare ss on ss.spel_id = s.id
join dart.spelare sp on sp.id = ss.spelare_id
left join dart.runda r on r.spel_id = s.id and r.spelare_id = ss.spelare_id
where s.typ = 'x01'
group by s.id, ss.spelare_id, sp.namn, ss.vinnare, ss.resultat;

-- Övningar och cricket per spel och spelare
create or replace view dart.v_resultat with (security_invoker = true) as
select s.id as spel_id, ss.spelare_id, sp.namn, s.typ, s.start, s.slut, s.match_id, s.kalla, s.installningar, ss.vinnare,
       coalesce(sum(r.pilar), 0) as pilar,
       coalesce(sum(r.traffar), 0) as traffar,
       coalesce(sum(r.marks), 0) as marks,
       coalesce(count(r.runda), 0) + coalesce((ss.resultat ->> 'rundor')::int, 0) as rundor,
       case s.typ
         when 'bobs27' then 27 + coalesce(sum(case when r.traffar > 0 then r.traffar * 2 * r.mal_nummer else -2 * r.mal_nummer end), 0)
         when 'jdc' then coalesce(sum(case when r.mal ~ '^D' then 50 * r.traffar
                                           else r.mal_nummer * r.marks + case when r.shanghai then 100 else 0 end end), 0)
         when 'scoring' then coalesce(sum(r.poang_traff), 0)
       end as poang,
       case when s.typ = 'cricket' then
         round((coalesce(sum(r.cricket_marks), 0) + coalesce((ss.resultat ->> 'marks')::int, 0)) * 1.0
               / nullif(coalesce(count(r.runda), 0) + coalesce((ss.resultat ->> 'rundor')::int, 0), 0), 2)
       end as mpr
from dart.spel s
join dart.spel_spelare ss on ss.spel_id = s.id
join dart.spelare sp on sp.id = ss.spelare_id
left join dart.v_runda_pil r on r.spel_id = s.id and r.spelare_id = ss.spelare_id
where s.typ <> 'x01'
group by s.id, ss.spelare_id, sp.namn, ss.vinnare, ss.resultat;

-- Träff per mål (dubblar, bull m.m.) och spelare, alla övningar
create or replace view dart.v_mal with (security_invoker = true) as
select p.spelare_id, sp.namn, p.mal, p.typ, count(*) as pilar, count(*) filter (where p.traff) as traffar,
       min(p.start) as forsta, max(p.start) as senaste
from dart.v_pil p join dart.spelare sp on sp.id = p.spelare_id
where p.mal is not null
group by p.spelare_id, sp.namn, p.mal, p.typ;

grant select on dart.v_pil, dart.v_runda_pil, dart.v_x01, dart.v_resultat, dart.v_mal to authenticated;
