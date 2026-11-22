# Överlämning: Darttränaren (från molnsession 2026-11-22)

Läs detta först, följ sedan skillen `obsidian-projekt`.

## Beslut (Henrik 2026-11-21/22)
- **Projekt:** Darttränaren – egen träningsapp som ersätter My Dart Training (Android, gratis, `.mdt`-backup till Dropbox `/Apps/DartTrainer/`), med synk mellan Android-telefonen och iPaden.
- **Arkitektur:** som Skyttestatistik (`Lunkster/skytte` – kopiera mönstren därifrån: `lib.js`, `app.js`, `sw.js`, manifest, tester med attrapp, `CLAUDE.md`).
  - Statisk PWA, mobil först, GitHub Pages, repo `Lunkster/darttranare` (publikt, inga personuppgifter). **Repot är inte skapat än** – Henrik skapar det tomt.
  - Lokal kod: `~/Dokument/Claude/Darttranare/kod/darttranare`, arbetsfiler i `~/Dokument/Claude/Darttranare/`.
  - Supabase: eget schema `dart` i projektet `tht` (`nlvgisjssbjethumvgdz`) – gratisplanen tillåter två projekt. Rör aldrig `public` (golf) eller `skytte`.
  - Konto `h.lundqvist+dart@gmail.com`, rollen `dart` i app_metadata styr RLS (som skytte).
  - Offline först: spel får uuid i appen, sparas lokalt och skickas med RPC `dart.spara_spel(jsonb)` (idempotent) när nät finns.
  - Egna SVG-diagram utan bibliotek. Svenska, SI-format (24 h, ÅÅÅÅ-MM-DD, decimalkomma).
- **v0.1.0 ska ha:** X01 (301/501, besök som totalsumma, fråga pilar på dubbel nära utgång, checkout), dubbelträning (Bob's 27, Round the World på dubblar, JDC Challenge), 100 pilar mot valfritt mål (S/D/T/miss per pil), Cricket (MPR) – solo och flera spelare.
- **Import:** historiken från `.mdt` (SQLite, tyska tabellnamn) importeras – och nya backuper ska kunna importeras tills bytet är klart.

## Gjort
- `supabase/01_schema.sql` – tabeller `spelare`, `spel`, `spel_spelare`, `runda` (X01-besök), `pil` (en rad per pil: `mal` = siktat mål, `segment` = träff), RLS, `spara_spel`, `ta_bort_spel`.
- `supabase/02_vyer.sql` – `v_pil`, `v_runda_pil`, `v_x01` (snitt, första 9, dubbelpilar, checkout, 100+/140+/180), `v_resultat` (Bob's 27-poäng, JDC-poäng, scoring, MPR), `v_mal` (träff per mål).
- `supabase/03_konto.sql` – rollen till kontot.
- **Inget är kört i Supabase än** (godkännanderutan hann inte besvaras från mobilen). Kör som migreringar `dart_01_schema`, `dart_02_vyer`, sedan `get_advisors`.
- `rapport_fran_mdt.py` – analys av en `.mdt` till HTML-rapport (visar hur backupen är uppbyggd).

## .mdt-strukturen (My Dart Training, user version 48)
- `Spieler` (id, name) – Henrik = id 2. `Profile` id 1 = Henrik (soloövningar).
- X01 solo/mot CPU: `xGame` (startScore, gesamtScore, gesamtDarts; startScore 0 = poängträning 7 rundor) + `aufnahme` (round, score, darts, dartsOnDouble, checkout; entityId = xGame.id). Vinst mot CPU: `challengeGame.win` (xGameId).
- X01 flera spelare: `xGameMp` → `xGameMpSet` → `xGameMpLeg` (siegerId) → `xGameSpieler` (legId, spelerId) + `aufnahmeMp` (entityId = xGameSpieler.id).
- Cricket: `cricketMp/Set/Leg` + `cricketGameSpieler` (rounds, marks, legId, spielerId) – bara summor, inga pilar → `spel_spelare.resultat = {"marks":..,"rundor":..}`.
- JDC: `jdcChallenge` (punkte) + `jdcScoringTarget` (target 10–20, singles/doubles/triples/misses, part 1/3) + `dartTarget` (entityName 'JdcChallenge', D1–D20/BULL, hits) för dubbeldelen.
- Bob's 27: `Bob27` + `dartTarget` (entityName 'Bob27', 3 pilar per dubbel).
- Scoring: `scoring` (target, throws, singles/doubles/triples/misses, first50/second50).
- Obs: `created_at` har NUMERIC-affinitet – jämför med `substr(created_at,1,4)`, inte mot textliteral.
- Ej i v0.1: Halve-it, cricketScoring-träning, poängträning (startScore 0).

## Nästa steg
1. Henrik skapar tomt repo `Lunkster/darttranare` (public).
2. Kör migreringarna i Supabase; Henrik exponerar schemat `dart` (Project Settings → Data API → Exposed schemas) och skapar kontot (Auto Confirm); Claude sätter rollen.
3. Bygg appen v0.1.0 + tester med attrapp.
4. Importskript `import/mdt.py` → anrop till `spara_spel` (spelarnamn från `Spieler`, kalla 'mdt').
5. Obsidian: `Projekt/Darttränaren/` – MOC, projektdokument, önskelista, datamodell; länka till [[Dart-klubbdatabas]]; dagbok.
