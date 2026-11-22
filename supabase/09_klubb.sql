-- 09: Koppling till klubbappen för Bankeryds dartklubb (Henrik 2026-11-22)
--
-- Klubbens statistik (tävlingar på n01darts.com och distriktsserien) ligger i ett eget Supabase-projekt
-- (bdc-statistik) bakom klubbens inloggning. Darttränaren kopierar ingenting därifrån: appen läser direkt
-- med klubbappens inloggning (samma webbadress, lunkster.github.io). Här sparas bara vilken spelare man är
-- i klubbappen, så att kopplingen följer med till alla ens telefoner.

alter table dart.spelare add column bdc_id integer;   -- spelare.id i bdc-statistik, null = inte kopplad
comment on column dart.spelare.bdc_id is 'Spelarens id i klubbappen bdc-statistik (Bankeryds dartklubb)';

-- Var och en sätter sin egen koppling (policyn dart_andra släpper bara igenom den egna raden)
grant update (bdc_id) on dart.spelare to authenticated;
