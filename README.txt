TÓVIZI RECRUITMENT – V5 ADMIN BIZTONSÁGI + LINK TRACKING

A csomag a korábbi működő V4 verzióra épül. Az index.html-t NEM módosítja.

MEGTARTOTT FUNKCIÓK
- személyre szabott 6 számjegyű linkek
- kisbetűvel megadott név automatikus nagy kezdőbetűsítése
- fekete név + UV-zöld, nem teljes magasságú highlight
- link megnyitás státusz és megnyitásszám
- összes / átlagos / utolsó aktív megtekintési idő
- aktív oldal-idő mérése visibilitychange + pagehide alapján
- link aktiválás/deaktiválás/törlés/másolás
- meglévő üzenetkezelés változatlanul

ÚJ ADMIN BIZTONSÁG
- személyes admin felhasználói fiókok email + jelszó alapján
- nincs publikus, bárki által használható regisztráció
- az első admin egyszeri setup képernyőn hozható létre a meglévő ADMIN_PASSWORD segítségével
- további adminok az Adminok menüből hozhatók létre
- jelszavak PBKDF2-SHA-256 hashként tárolódnak, plaintext jelszó nem kerül D1-be
- 12+ karakteres jelszó, nagybetű, kisbetű és szám kötelező
- login/reset rate limiting
- HttpOnly + Secure + SameSite=Lax session cookie
- CSRF védelem az admin állapotmódosító API-khoz
- session versioning: jelszó-reset után a korábbi sessionök érvénytelenné válnak
- admin fiók letiltható/aktiválható; saját fiók nem tiltható le saját magával

EMAIL NÉLKÜLI JELSZÓ-VISSZAÁLLÍTÁS
- minden adminhoz egyszer megjelenő recovery secret készül
- a recovery secret csak hashként kerül D1-be
- jelszó elfelejtése esetén email + recovery kód + új jelszó szükséges
- sikeres reset után új recovery kód generálódik és a régit lecseréli
- később Resend/email alapú reset hozzáadható a domain beállítása után

D1
Az új admin táblákat a Cloudflare Function első használatkor automatikusan létrehozza:
- admin_users
- admin_rate_limits
A personalized_links meglévő tracking mezői automatikusan biztosítva vannak.

ELSŐ HASZNÁLAT
1. Deploy után nyisd meg /admin.
2. Ha még nincs admin_users rekord, megjelenik az "Első admin beállítása" képernyő.
3. Add meg a nevet, emailt, új erős jelszót és a Cloudflare ADMIN_PASSWORD secret jelenlegi értékét.
4. A rendszer egyszer megmutat egy recovery kódot. Mentsd el biztonságos helyre.
5. Ezután személyes email+jelszó belépést használj.

A csomag nem tartalmazza és nem módosítja az index.html-t.
