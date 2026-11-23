# Instruktioner för Claude – Darttränaren

- Läs först Obsidian `Projekt/Darttränaren/Darttränaren - Projektdokument.md` (tågordning, logg) och önskelistan.
- Följ skillen `obsidian-projekt`: logga i projektdokumentet, temporära filer i `~/Dokument/Claude/Darttranare/`, aldrig i Obsidian.
- Databasen är schemat `dart` i Supabase-projektet `tht` (`nlvgisjssbjethumvgdz`) – rör aldrig `public` (golf), `skytte`, `film` eller `dryck`.
- Schemaändringar: ny numrerad fil i `supabase/` + `apply_migration` (namn `dart_NN_...`). Kör `get_advisors` efteråt. Uppdatera `docs/datamodell.md` och kopian i Obsidian.
- Lagra aldrig härledda värden – lägg logiken i vyerna. Spelreglerna i `spel.js` och vyerna i `02_vyer.sql` ska ge samma poäng.
- Anrop mot PostgREST kräver headern `Accept-Profile: dart` (läsning) och `Content-Profile: dart` (skrivning) – se `lib.js`.
- Versionsnummer i `index.html` (`?v=`), i importerna och i `sw.js` ändras vid varje release.
- Inga personuppgifter, backuper eller nycklar (utom publishable key) i repot – `.mdt`-filer och importens utdata är ignorerade.
- Nytt i appen (i-knappen) visar `nyheter.json`. Skriv kort i Obsidian *Darttränaren - Nyheter* (en mening per punkt, version i slutet), kör `python3 ~/Dokument/Claude/Darttranare/skript/nyheter.py` och committa `nyheter.json`.
- Testa före commit: `tests/logik.html` och `tests/attrapp.html?flode` ska båda visa `fel: 0` (se `tests/README.md`).
- Gränssnittet: fokus på poängen, stora knappar för stora fingrar, extrafunktioner valbara (`val()` i `lib.js`, Min sida) – princip från Sten 2026-11-22.
- Under pågående spel får inget scrolla, på någon skärmstorlek (Henrik 2026-11-22). Prova nya spelvyer i 360×640, 375×667, 768×1024, 1024×768 och 740×360.
- Importen hittar spelare på `spelare.mdt_namn` – alias (`namn`) byts fritt i appen.
- Spel på distans (v0.6): läget delas i `live_match` med versionsnummer (`live_skicka`). Bara den som har turen skriver in; kod i `spela.js` under *distans*. Testas i flödestestet genom att ändra attrappens `live_match` (motspelarens telefon).
- Klubbappen (v0.7): `klubb.js` läser projektet `bdc-statistik` (Bankeryds dartklubb, annat Supabase-konto) direkt med klubbappens inloggning `bdc-session` – kopiera aldrig klubbens data hit. Beroende av klubbens `v_turnering_statistik`, `v_ds_spelare`, `turnering` och `spelare` och adresserna `#/tavling/<tdid>`, `#/serien/<tdid>`, `#/spelare/<id>`. Ändras de i klubbappen måste `klubb.js` följa med.
- Turneringar skapas av admin: `app_metadata.dart_admin = true` (Henriks konto). Undantag (v0.8): en löpande serie skapar vem som helst med konto som själv är en av de två. Set räknas i appen ur `v_turnering_legvinst` – lagras inte. Fler admins: sätt flaggan i Supabase (SQL), lägg inte e-post i repot.
- **Ny person i gruppen:** Henrik skapar kontot i Supabase (Authentication → Users → Add user, Auto Confirm) och säger e-post och spelarnamn. Claude sätter rollen och kopplar spelaren (se kommentaren överst i `supabase/04_konton.sql`) – finns personen redan som gäst kopplas den raden, så historiken följer med.
