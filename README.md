# Darttränaren

Egen träningsapp för dart som ersätter My Dart Training, med synk mellan telefon och iPad. X01, cricket och övningar, med statistik.

- **App:** https://lunkster.github.io/darttranare/ – statisk webbapp (PWA) på GitHub Pages, inga beroenden, fungerar offline
- **Databas:** schemat `dart` i Supabase-projektet `tht` (eu-north-1, ref `nlvgisjssbjethumvgdz`) – helt åtskilt från golfens och skyttets tabeller
- **Dokumentation:** Obsidian `Projekt/Darttränaren/` – projektdokument, önskelista, datamodell

## Spel i v0.1
- **X01** 301/501, dubbel ut, besöket skrivs in som summa. Nära utgång frågar appen hur många pilar som gick på dubbel och med vilken pil man gick ut. Utgångsförslag. Först till 1–5 legs, en eller flera spelare.
- **Cricket** 15–20 och bull, pil för pil, solo eller flera spelare. MPR.
- **Bob's 27**, **Runt dubblarna** (3 pilar per dubbel), **JDC Challenge**
- **Pilar mot ett mål** – 30–100 pilar mot valfritt mål, singel/dubbel/trippel/miss per pil

## Struktur

| Sökväg | Innehåll |
| --- | --- |
| `index.html`, `app.js` | Sidan, router, inloggning med e-post, spelarlistan, offlinekön |
| `spel.js` | Spellogik utan sidan: X01-regler, utgångar, spelplaner, poäng, cricket |
| `spela.js` | Starta och spela – alla speltyper, pågående spel sparas lokalt |
| `historik.js` | Alla spel, ta bort |
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
- Egna konton i en gemensam grupp (färre än 5 personer): alla ser allas spel och statistik, men ett spel ändras bara av den som skapade det eller spelade i det. Konton delas ut för hand – ingen egen registrering. Ingen anonym läsning.
- Svenska och SI-format: 24 h, ÅÅÅÅ-MM-DD, decimalkomma – oberoende av webbläsarens språk.
