# Instruktioner för Claude – Darttränaren

- Läs först Obsidian `Projekt/Darttränaren/Darttränaren - Projektdokument.md` (tågordning, logg) och önskelistan.
- Följ skillen `obsidian-projekt`: logga i projektdokumentet, temporära filer i `~/Dokument/Claude/Darttranare/`, aldrig i Obsidian.
- Databasen är schemat `dart` i Supabase-projektet `tht` (`nlvgisjssbjethumvgdz`) – rör aldrig `public` (golf), `skytte`, `film` eller `dryck`.
- Schemaändringar: ny numrerad fil i `supabase/` + `apply_migration` (namn `dart_NN_...`). Kör `get_advisors` efteråt. Uppdatera `docs/datamodell.md` och kopian i Obsidian.
- Lagra aldrig härledda värden – lägg logiken i vyerna. Spelreglerna i `spel.js` och vyerna i `02_vyer.sql` ska ge samma poäng.
- Anrop mot PostgREST kräver headern `Accept-Profile: dart` (läsning) och `Content-Profile: dart` (skrivning) – se `lib.js`.
- Versionsnummer i `index.html` (`?v=`), i importerna och i `sw.js` ändras vid varje release.
- Inga personuppgifter, backuper eller nycklar (utom publishable key) i repot – `.mdt`-filer och importens utdata är ignorerade.
- Testa före commit: `tests/logik.html` och `tests/attrapp.html?flode` ska båda visa `fel: 0` (se `tests/README.md`).
- Gränssnittet: fokus på poängen, stora knappar för stora fingrar, extrafunktioner valbara (`val()` i `lib.js`, Min sida) – princip från Sten 2026-11-22.
- Importen hittar spelare på `spelare.mdt_namn` – alias (`namn`) byts fritt i appen.
- **Ny person i gruppen:** Henrik skapar kontot i Supabase (Authentication → Users → Add user, Auto Confirm) och säger e-post och spelarnamn. Claude sätter rollen och kopplar spelaren (se kommentaren överst i `supabase/04_konton.sql`) – finns personen redan som gäst kopplas den raden, så historiken följer med.
