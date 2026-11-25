# Pilgrym (Darttränaren)

Appen heter **Pilgrym** (pil + grym, beslut Henrik 2026-11-25); projektet och repot heter fortfarande Darttränaren / `darttranare`. Egen träningsapp för dart som ersätter My Dart Training, med synk mellan telefon och iPad. X01, cricket och övningar, med statistik.

- **App:** https://lunkster.github.io/darttranare/ – statisk webbapp (PWA) på GitHub Pages, inga beroenden, fungerar offline
- **Databas:** schemat `dart` i Supabase-projektet `tht` (eu-north-1, ref `nlvgisjssbjethumvgdz`) – helt åtskilt från golfens och skyttets tabeller
- **Dokumentation:** Obsidian `Projekt/Darttränaren/` – projektdokument, önskelista, datamodell

## Spel i v0.1
- **X01** 301/501, dubbel ut, besöket skrivs in som summa. Nära utgång frågar appen hur många pilar som gick på dubbel och med vilken pil man gick ut. Utgångsförslag. Först till 1–5 legs, en eller flera spelare.
- **Cricket** 15–20 och bull, pil för pil, solo eller flera spelare. MPR.
- **Bob's 27** (valfritt att fortsätta på minus), **Runt dubblarna** (3 pilar per dubbel), **JDC Challenge**
- **Pilar mot ett mål** – 30–100 pilar mot valfritt mål, singel/dubbel/trippel/miss per pil
- **Catch 40** (v0.10) – utgångarna 61–100, högst 6 pilar på varje; ut på 2 pilar ger 3 p, 3 pilar 2 p, 4–6 pilar 1 p
- **Turneringar** (v0.5) – serie eller utslag i X01 eller cricket, tabell, matcher i valfri ordning och samtidigt
- **Tävlingar från klubben** (v0.7) – i X01-statistiken syns ens tävlingar från klubbappen för Bankeryds dartklubb bredvid träningen: egna nyckeltal, rosa punkter i grafen (snitt per tävlingskväll), tävlingslista med länk till varje tävling och distriktsserien. Läses direkt i klubbappen med dess inloggning – inget kopieras
- **Klicka dig vidare** (v0.9) – namn, resultat, rader och turneringar är länkar till spelare (`#/spelare/<id>`), match (`#/match/<id>`), leg (`#/leg/<id>`) och turnering
- **Löpande serie** (v0.8) – två spelare möts i 10, 20 eller 30 matcher i tur och ordning, med valfri spelform, legs och set
- **Spel på distans** (v0.6) – två spelare i en turneringsmatch på var sin telefon; var och en skriver in sina kast och båda ser ställningen (avstämning var 1,5 s mot `live_match`)

## Struktur

| Sökväg | Innehåll |
| --- | --- |
| `index.html`, `app.js` | Sidan, router, inloggning med e-post, spelarlistan, offlinekön |
| `spel.js` | Spellogik utan sidan: X01-regler, utgångar, spelplaner, poäng, cricket |
| `spela.js` | Starta och spela – alla speltyper, pågående spel sparas lokalt |
| `historik.js` | Alla spel, ta bort |
| `hem.js` | Startsidan: fortsätt spel, nästa turneringsmatch, snabbstart, form, senaste spel |
| `sidor.js` | Sidor för en match och ett leg (resultat, legs, besök/rundor) – nås via länkar |
| `turnering.js` | Turneringar: lista, skapa (admin; löpande serie alla), tabell, lottning, ställning, starta matcher |
| `klubb.js` | Tävlingar från klubbappen (bdc-statistik): läser med klubbappens inloggning, kort i statistiken, länkar |
| `jag.js` | Min sida: byta alias, välja vad som visas under spelet |
| `nyheter.js`, `nyheter.json` | Nytt i appen (i-knappen) – `nyheter.json` görs från Obsidian-anteckningen *Darttränaren - Nyheter* |
| `statistik.js`, `diagram.js` | Statistik per spelare med egna SVG-diagram |
| `lib.js` | Supabase-anrop (schema `dart`), inloggning, offlinekö, format |
| `sw.js`, `manifest.webmanifest`, `ikon*` | Installerbar app, offline |
| `supabase/` | Schema, vyer och behörighet som numrerade SQL-filer |
| `import/mdt.py` | Import av backup från My Dart Training (`.mdt`) |
| `docs/datamodell.md` | ER-diagram och vyer |
| `tests/` | Logiktester och hela appen mot en Supabase-attrapp, i webbläsaren |

## Principer
- Offline först: ett spel får sitt id (uuid) i appen, sparas lokalt efter varje kast och skickas med `dart.spara_spel` när leget/övningen är klar. Samma spel kan skickas flera gånger utan dubbletter.
- Härledda värden (snitt, poäng, MPR) lagras aldrig – de räknas i vyerna (`v_x01`, `v_resultat`, `v_mal`).
- Standard-Postgres, ingen logik som bara finns i Supabase.
- Egna konton i en gemensam grupp (färre än 5 personer): man ser och ändrar bara spel man själv var med i eller har skapat. Spelarlistan är gemensam. Konton delas ut för hand – ingen egen registrering. Ingen anonym läsning.
- Rent gränssnitt med fokus på poängen och stora knappar; det fiffiga runtomkring går att stänga av på Min sida (Sten 2026-11-22).
- Under pågående spel fyller vyn skärmen och scrollar aldrig – storlekarna följer skärmens höjd, liggande skärm får två kolumner (`body.spelar` i `style.css`).
- Svenska och SI-format: 24 h, ÅÅÅÅ-MM-DD, decimalkomma – oberoende av webbläsarens språk.
