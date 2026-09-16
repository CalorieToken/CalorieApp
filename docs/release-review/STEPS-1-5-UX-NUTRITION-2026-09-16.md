# Stappen 1–5 — UX en veilige Nutri-samenvatting

Status op 16 september 2026: stap 1–3 live hersteld; stap 4 gericht afgerond
voor Jubileum en CalorieApp/Ecosysteem/CalorieToken-WP; stap 5 is voor die
beperkte scope op WordPress live/gepland en voor externe socials handmatig
publicatieklaar.

## Harde acceptatie-eisen

- duidelijke routes naar Account, Product zoeken, USDA-basisvoeding en Eetdagboek;
- lokale bronherkenbare illustratie bij een ontbrekende of onbetrouwbare foto;
- OFF, USDA en overig samen in totalen, maar alleen brongeleverde OFF-letters in A–E;
- geen oude privédata na logout, reload of accountwisseling;
- 360, 412 en 1440 pixels, toetsenbordfocus, reduced motion en RTL;
- exact elf talen: en, nl, zh-Hans, hi, es, ar, fr, bn, pt, id en ur;
- bestaande huisstijl, logo’s, Xaman-login, CalorieHelp en juridische grenzen behouden;
- geen persoonlijke gezondheidsscore of niet-live Web3-functie als actief presenteren.

## Stap 1 — CalorieApp, account en eten vastleggen

Live op frontendcommit `176a4e6debfad3e033736e3cfe08dc106a1d8df0`
en backendcommit `62001b6db401356cc5f5fda1faca4db1f0586230`.

De live app heeft drie routes, OFF-naam/barcodesearch, een afzonderlijke
USDA-catalogus, portiekeuze in werkelijke grammen, periodetotalen, bronverdeling,
OFF A–E-dekking, lokale fallbackillustraties en elf talen. Openbare live tests
bevestigden OFF-resultaten, een resultaat zonder bronfoto met lokale illustratie
en USDA-resultaten met FDC-bronlink.

Nog menselijk te controleren: echte Xaman sign/return, een ingelogde
dagboekmutatie en de fysieke camerascanner.

## Stap 2 — WordPress, Xaman-kaart en minimale Nutri-weergave

Heading Repair 1.3.0 staat live naast Identity Bridge 0.3.29, Login Repair 1.0.0
en Site Style 1.4.46. De cache is geleegd. ZIP: 12 bestanden, SHA-256
`5c7736741570bafd1247ef4a42d855d682e9bcbe352ef13d9d668c0ccbe6f5e5`.

De app meldt de actuele sessietoestand uitsluitend aan de vertrouwde
WordPress-ouder. De live afgemelde toestand is nu `Not signed in` en blijft niet
meer op `Checking…` staan. Het compacte voedingsblok bestaat, maar is afgemeld
correct verborgen. Het accepteert alleen geldige, intern consistente aggregaten
uit het exacte app-frame en bewaart niets in WordPress of browseropslag.

Nog menselijk te controleren: zichtbare OFF/USDA/overig- en A–E-samenvatting na
een echte Xaman-login met een echt dagboek.

## Stap 3 — website, CalorieHelp en toegankelijkheid

FAQ, Showcases, CalorieHelp, taalwissel, app-focusmodus en bron-/fallbackuitleg
staan live. De FAQ-actie voor CalorieApp opent de juiste stappen en bronnen;
Arabisch gebruikt een RTL-shell. Focusmodus schakelt live heen en terug zonder
CalorieHelp of de bestaande pagina te vervangen.

De GitHub-browserpoort controleerde 360/412/1440, elf talen, RTL, toetsenbord,
fallbacks, originblokkade en stale clearing. Fysieke mobiele browsers blijven
een menselijke eindcontrole.

## Stap 4 — focusreview C1 en C2 afgerond

De review gebruikt nog steeds releasecommit `62001b6`, frontend-hotfix
`176a4e6`, de live deploys, actieve WordPress-versies en groene GitHub-runs.
Daarbovenop geldt de planwijziging:

- actief: `C1` CalorieApp/Ecosysteem/CalorieToken-WP en `C2` Jubileum;
- uitgesteld: `C3`, `C4` en `C5` tot volgende week;
- huidige, historische en toekomstige claims zijn uit elkaar gehouden;
- verouderde vier-talen-, BigchainDB/IPFS-, oude Testnetfoto- en PR-#144-media
  zijn uit de gerichte queue gehaald;
- geselecteerde PNG/MP4/VTT-bestanden zijn inhoudelijk, technisch en op hash
  gecontroleerd.

De oorspronkelijke 97 voorstellen, 214 mediapaden en open controles blijven
als auditbron behouden; ze zijn niet stilzwijgend herschreven. Alleen de
expliciet gekozen C1/C2-queue is nu vrijgegeven.

## Stap 5 — uitgevoerd voor de gerichte scope

Na de sessiestatusfix slagen 305/305 Node-regressies, ESLint, TypeScript,
Next.js-productiebouw en de GitHub Food UX isolated check. De bestaande backend-
en releasecontroles blijven groen.

Post 8079 staat live. Post 8080 is voor 17 september gepland; nieuwe C1-posts
8084, 8085 en 8086 volgen op 18, 21 en 23 september. De geselecteerde
socialqueue voor 16–24 september is met definitieve copy, CTA's, media en VTT
opgeleverd, maar kan zonder gekoppelde platformpublishers niet vanuit deze
omgeving worden ingepland.

De echte Xaman sign/return, een ingelogde dagboek-/WordPress-samenvatting en de
fysieke camerascan blijven open productacceptaties. De campagne omzeilt die
niet: zij beperkt haar claims tot publiek bewezen functies. C3–C5 en de rest
van de oorspronkelijke review wachten op de volgende afwerkingsronde en een
latere totale publicatie-GO.
