# Stappen 1–5 — UX en veilige Nutri-samenvatting

Status op 16 september 2026: stap 1–3 live hersteld; stap 4 aangepast op de
werkelijke live toestand; stap 5 en alle publicatie blijven geblokkeerd.

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

## Stap 4 — complete review op live toestand

De review gebruikt nu:

- geïntegreerde releasecommit `62001b6`;
- frontend-hotfix `176a4e6` en live deploy `dep-dal4kogae00c73fi7obg`;
- live backenddeploy `dep-dal42jmk1f9s73dkmc50`;
- actieve WordPress-versies en de bewezen live controles hierboven;
- geslaagde GitHub-runs `35066924812` en `35070538678`.

Alle 97 voorstellen, 214 mediapaden en bestaande open controles blijven
behouden. Historische datums worden niet ingehaald. De telling blijft 38 zonder
open controle en 59 met minstens één open controle totdat de voorstelreview zelf
wordt afgerond. Er is niets gepubliceerd, gepland of vervangen.

## Stap 5 — geblokkeerd

Na de sessiestatusfix slagen 305/305 Node-regressies, ESLint, TypeScript,
Next.js-productiebouw en de GitHub Food UX isolated check. De bestaande backend-
en releasecontroles blijven groen.

Stap 5 mag pas verder na:

1. echte Xaman sign/return;
2. minimale ingelogde dagboek- en WordPress-samenvattingscontrole;
3. resterende menselijke/native/beeldcontroles;
4. één expliciete totale publicatie-GO van Pieter.

Posts 8079 en 8080 blijven tot dan `draft`; er wordt niets automatisch gepland
of gepubliceerd.
