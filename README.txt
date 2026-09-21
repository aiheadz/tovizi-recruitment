Tóvizi Recruitment – PDF text + layout fix + admin restore

Ez a csomag az előző, jó PDF TEXT ONLY index.html-re épül.

Csak a kért javítások történtek:
1. A négy recruitment elem 4 oszlopos elrendezést kapott, így nem marad üres ötödik négyzet.
2. A „A megfelelő embert egyre nehezebb megtalálni…” blokk címe és a HR-szöveg rendezettebb, kétoszlopos pozíciót kapott; mobilon egymás alá törik.
3. Visszakerült a működő Cloudflare Pages Functions admin + személyre szabott link rendszer.

A backend:
- /admin admin felület
- üzenetek kezelése
- személyre szabott 6 számjegyű link generátor
- link másolása közvetlenül generálás után
- személyre szabott név a landing oldalon
- /api/* és /123456 útvonalak

A D1 binding neve: DB
A szükséges Secrets: ADMIN_PASSWORD, ADMIN_SESSION_SECRET
