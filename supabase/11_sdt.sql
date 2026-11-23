-- 11: Träffar uppdelade på singel, dubbel och trippel (önskemål 2026-11-23, Pilar mot ett mål)
--
-- Nya kolumner sist i v_runda_pil och v_resultat: singlar, dubblar, tripplar = träffar på målet med 1, 2 eller 3 gånger.
-- Räknas ur pilarna som allt annat – inget lagras.

create or replace view dart.v_runda_pil with (security_invoker = true) as
select spel_id, spelare_id, runda, typ, min(mal) as mal, min(mal_nummer) as mal_nummer,
       count(*) as pilar,
       count(*) filter (where traff) as traffar,
       coalesce(sum(mult) filter (where traff), 0) as marks,
       coalesce(sum(nummer * mult) filter (where traff), 0) as poang_traff,
       coalesce(sum(mult) filter (where nummer between 15 and 20 or nummer = 25), 0) as cricket_marks,
       (bool_or(traff and mult = 1) and bool_or(traff and mult = 2) and bool_or(traff and mult = 3)) as shanghai,
       count(*) filter (where traff and mult = 1) as singlar,
       count(*) filter (where traff and mult = 2) as dubblar,
       count(*) filter (where traff and mult = 3) as tripplar
from dart.v_pil
group by spel_id, spelare_id, runda, typ;

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
       end as mpr,
       coalesce(sum(r.singlar), 0) as singlar,
       coalesce(sum(r.dubblar), 0) as dubblar,
       coalesce(sum(r.tripplar), 0) as tripplar
from dart.spel s
join dart.spel_spelare ss on ss.spel_id = s.id
join dart.spelare sp on sp.id = ss.spelare_id
left join dart.v_runda_pil r on r.spel_id = s.id and r.spelare_id = ss.spelare_id
where s.typ <> 'x01'
group by s.id, ss.spelare_id, sp.namn, ss.vinnare, ss.resultat;
