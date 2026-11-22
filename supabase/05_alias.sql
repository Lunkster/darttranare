-- 05: Alias – var och en byter själv sitt spelarnamn (Henrik 2026-11-22)
--
-- namn är spelarens alias och får inte krocka med någon annans, oavsett stora/små bokstäver.
-- mdt_namn är namnet i My Dart Training, så att nya backuper hamnar på rätt spelare även efter namnbyte.
-- Inloggade får bara ändra namn (och aktiv) – inte koppla om konton. Egen rad eller gäst, enligt policyn i 04.

alter table dart.spelare add column mdt_namn text unique;
update dart.spelare set mdt_namn = namn;   -- alla spelare hittills kommer från importen

alter table dart.spelare drop constraint spelare_namn_key;
create unique index spelare_namn_unik on dart.spelare (lower(namn));
alter table dart.spelare add constraint spelare_namn_trim check (namn = btrim(namn));

revoke update on dart.spelare from authenticated;
grant update (namn, aktiv) on dart.spelare to authenticated;
