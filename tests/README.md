# Tester

Testerna körs i webbläsaren – inga beroenden. Supabase ersätts av en attrapp i minnet (`attrapp.js`, påhittade spelare), så testerna rör aldrig den riktiga databasen.

```bash
cd ~/Dokument/Claude/Darttranare/kod/darttranare && python3 -m http.server 8767
```

- http://localhost:8767/tests/logik.html – reglerna i `spel.js`: X01 (bust, omöjliga poäng, utgångar 2–170), spelplaner, poäng för Bob's 27, JDC (samma som My Dart Training), pilar mot ett mål och cricket.
- http://localhost:8767/tests/attrapp.html?flode – hela appen: inloggning, ny spelare, X01 med bust, utgång och ångra, Bob's 27, solocricket med ångra, offlinekö som skickas när nätet kommer tillbaka, historik med ta bort, statistik och kontroll av datumformat.
- http://localhost:8767/tests/attrapp.html – appen mot attrappen att klicka runt i (kod `kod123`).

Båda testsidorna ska sluta med `fel: 0` (syns också i flikens titel).
