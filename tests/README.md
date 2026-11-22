# Tester

Testerna körs i webbläsaren – inga beroenden. Supabase ersätts av en attrapp i minnet (`attrapp.js`, påhittade spelare), så testerna rör aldrig den riktiga databasen.

```bash
cd ~/Dokument/Claude/Darttranare/kod/darttranare && python3 -m http.server 8767
```

- http://localhost:8767/tests/logik.html – reglerna i `spel.js`: X01 (bust, omöjliga poäng, utgångar 2–170), spelplaner, poäng för Bob's 27, JDC (samma som My Dart Training), pilar mot ett mål och cricket.
- http://localhost:8767/tests/attrapp.html?flode – hela appen: inloggning med e-post, egen spelare som förval, ny gäst, X01 med bust, utgång och ångra, Bob's 27, solocricket med ångra, offlinekö som skickas när nätet kommer tillbaka, historik med ta bort (bara egna spel – servern nekar andras), statistik, kontroll av datumformat, Min sida (alias som krockar nekas, nytt alias syns) och val under spelet (utan utgångsförslag och dubbelfråga), turneringar (skapa serie, spela, tabell) och spel på distans (start, väntan på motspelaren, gå med från startsidan, konflikt när motspelaren hann före, avbrott).
- http://localhost:8767/tests/attrapp.html – appen mot attrappen att klicka runt i (`anna@exempel.se`, lösenord `kod123`; Bo: `bo@exempel.se`, `bo456`).

Båda testsidorna ska sluta med `fel: 0` (syns också i flikens titel).
