# CalorieToken — live herstel en gerichte stap 4–5-publicatie

Datum: 16 september 2026
Status: stap 1–3 staan live; stap 4 is gericht afgerond voor Jubileum en
CalorieApp/Ecosysteem/CalorieToken-WP; de WordPress-uitvoering van stap 5 is
live/gepland en de externe socialqueue is handmatig publicatieklaar.

## Beslisgrens

Op 16 september 2026 gaf Pieter een nieuwe, expliciete campagneopdracht:
uitsluitend `C1` CalorieApp/Ecosysteem/CalorieToken-WP en `C2` Jubileum nu
volledig uitwerken en publiceren/plannen. `C3`, `C4` en `C5` blijven tot
volgende week buiten scope. Die gerichte toestemming vervangt voor deze twee
campagnelijnen de eerdere publicatieblokkade; zij is geen algemene GO voor de
uitgestelde onderdelen.

De volgende vaste eisen blijven leidend:

1. volgorde 1 → 2 → 3 → 4 → 5;
2. bestaande Xaman-login, Identity Bridge 0.3.29, Login Repair 1.0.0, Site Style
   1.4.46, huisstijl, logo’s, CalorieHelp en bestaande content behouden;
3. OFF en USDA samen duidelijk tonen zonder een USDA Nutri-Score te verzinnen;
4. een ontbrekende, kapotte of niet-toegestane productfoto vervangen door een
   lokale bronherkenbare illustratie;
5. exact elf talen behouden: en, nl, zh-Hans, hi, es, ar, fr, bn, pt, id en ur;
6. geen persoonlijke gezondheidsscore, geen nieuwe betaalde dienst, geen
   automatische inhaalpublicatie en geen wijziging van ICTHendrikse.

## Bewezen live toestand

| Onderdeel | Live bewijs |
|---|---|
| Geïntegreerde backend | commit `62001b6db401356cc5f5fda1faca4db1f0586230`; deploy `dep-dal42jmk1f9s73dkmc50`; `/health` 200; schema `20260902_0016` |
| CalorieApp-frontend | commit `176a4e6debfad3e033736e3cfe08dc106a1d8df0`; deploy `dep-dal4kogae00c73fi7obg` live |
| GitHub-controle | run `35066924812` op de geïntegreerde kandidaat en run `35070538678` op de sessiestatusfix: beide geslaagd |
| WordPress | Heading Repair 1.3.0 actief; Identity Bridge 0.3.29, Login Repair 1.0.0 en Site Style 1.4.46 behouden; cache geleegd |
| WordPress/CalorieApp-koppeling | iframe op `https://app.calorietoken.net`; status eindigt afgemeld op `Not signed in` in plaats van vast te blijven op `Checking…` |
| Privacyweergave | het samenvattingsblok bestaat maar is afgemeld verborgen; het wordt alleen zichtbaar na een geldig bericht uit het exacte app-frame met intern consistente totalen |
| WordPresscampagne | 8079 live; 8080, 8084, 8085 en 8086 met gecontroleerde UTC-datums gepland |

Rollback blijft mogelijk zonder datamigratie: backenddeploy
`dep-daj0i1m7bikc73aaop4g`; voor de frontend is de direct voorafgaande bewezen
deploy `dep-dal43eijnfac73cdn0mg` op commit `62001b6` beschikbaar. Heading Repair
1.3.0 kan afzonderlijk worden gedeactiveerd.

## Stap 1 — CalorieApp en voedingsdagboek

Live uitgerold en openbaar gevalideerd:

- OFF-naam- en barcodesearch met bronhoeveelheid, portiekeuze en expliciete
  opslaghandeling;
- afzonderlijke USDA-catalogusroute met FDC-nummer, 100-g-bronwaarden en
  invoer in werkelijke eetbare grammen;
- periodekeuze, totalen, filter, paginering, detail, verwijderen en duidelijke
  laad-, leeg-, fout- en sessiestaten;
- OFF, USDA en overig/onbekend tellen mee in nutriënttotalen; A–E bevat alleen
  door OFF aangeleverde Nutri-Score-letters;
- lokale alternatieve illustraties voor OFF, USDA en overig als een foto
  ontbreekt, kapot is of buiten de toegestane OFF-image-origin valt;
- elf talen en RTL-weergave.

Live is onder meer gecontroleerd dat `coca cola` OFF-resultaten met bron,
barcode, portie, nutriënten en A–E toont en dat een resultaat zonder bronfoto
de lokale OFF-illustratie gebruikt. De USDA-zoekroute leverde `rice`-resultaten,
waaronder FDC 2710825 met bronlink en 100-g-waarden.

Niet als uitgevoerd geclaimd: een echte Xaman-walletsignering, een muterende
dagboekhandeling met een echt account en een fysieke camerascanner. Daarvoor is
menselijke bediening nodig; er is tijdens deze run geen privésessie of data
aangemaakt.

## Stap 2 — WordPress, Xaman en minimale voedingsweergave

Live uitgerold:

- het deterministische pakket `calorietoken-heading-repair-1.3.0.zip` is actief
  (12 bestanden; SHA-256
  `5c7736741570bafd1247ef4a42d855d682e9bcbe352ef13d9d668c0ccbe6f5e5`);
- de companion vervangt geen login- of Site Style-plugin;
- focusmodus werkt heen en terug en CalorieHelp blijft beschikbaar;
- de app publiceert nu een versie-1 sessiestatus naar uitsluitend de vertrouwde
  WordPress-ouder; afgemeld wordt aantoonbaar `signed_out`/`Not signed in`;
- het voedingsblok accepteert alleen het exacte iframe en goedgekeurde origins,
  bewaart niets in WordPress of browseropslag en wist/verbergt oude data bij
  fout, reload, logout of ongeldige totalen;
- buiten het iframe komen alleen bronaantallen, OFF A–E-aantallen, dekking,
  periode, taal en toestand. Geen voedselnamen, maaltijden, calorieën, macro’s,
  datums, walletadres, account-ID, token of persoonlijke score.

De afgemelde live controle bewijst bewust dat het privéblok verborgen blijft.
Het zichtbaar worden met echte dagboektotalen blijft onderdeel van de nog open
menselijke Xaman-acceptatie.

## Stap 3 — website, FAQ, CalorieHelp en toegankelijkheid

Live uitgerold en openbaar gevalideerd:

- FAQ & snelle antwoorden, inclusief CalorieApp-, USDA-, vergelijkings-,
  fallbackbeeld- en OFF A–E-uitleg;
- de CalorieApp-FAQ-actie opent een volledig antwoord met stappen en bronnen;
- Showcases toont de nieuwe voedselreis en app-CTA’s;
- taalwissel werkt; de Arabische FAQ-shell is `rtl` en toont Arabische labels;
- de CalorieApp-focusknop wisselt correct tussen maximaliseren en terugkeren;
- bestaande header, accountkaart, Help-launcher, footer, cookiebediening en
  links zijn behouden.

De geïsoleerde browserpoort controleerde tevens 360, 412 en 1440 pixels,
toetsenbord-/focuscontracten, elf talen, RTL, fallbacks en stale-data-clearing.
Fysieke mobiele browsers blijven een menselijke eindcontrole.

## Stap 4 — gerichte campagnereview afgerond

De volledige reviewbron blijft ongewijzigd als auditspoor, maar de actieve
publicatiescope is teruggebracht tot `C1` en `C2`. Voor deze twee lijnen zijn:

- kanaalteksten herschreven op de werkelijk live functies;
- Jubileumbeeld, vijf video's/shorts, één App-poster en alle bijbehorende
  Engelse VTT-bestanden visueel/inhoudelijk en op bestandshash gecontroleerd;
- oudere BigchainDB/IPFS-visuals, een oude App-Testnetfoto, verouderde
  vier-talenmedia en het PR-#144-item uitgesloten;
- huidige, historische en toekomstige functionaliteit expliciet gescheiden;
- niet uitgevoerde Xaman-, ingelogde samenvattings- en fysieke cameracontroles
  buiten de gepubliceerde bewijsclaims gehouden;
- alle C3-, C4- en C5-items aantoonbaar uitgesteld.

De complete copybank, mediakeuze, kalender en uitsluitingen staan in
`FOCUSED-CAMPAIGN-STEP4-5-2026-09-16.md`. Historische datums zijn niet
automatisch ingehaald en de mogelijke X-overlap is vermeden door deze run niet
op X te plannen.

## Stap 5 — gerichte WordPress-uitvoering afgerond

Technisch bewijs:

| Controle | Resultaat |
|---|---:|
| Node-regressies na live sessiestatusfix | 305/305 geslaagd |
| Backend-pytest op geïntegreerde kandidaat | 1069 geslaagd, 24 overgeslagen, 0 mislukt |
| Gerichte login + voeding-integratie | 224/224 geslaagd |
| Python tool-/releasecontroles | 82/82 geslaagd |
| TypeScript `tsc --noEmit` | geslaagd |
| ESLint | 0 waarschuwingen, 0 fouten |
| Next.js 15.5.25 productiebuild | geslaagd |
| GitHub Food UX isolated check | run `35070538678` geslaagd |
| Heading Repair releasebuilder | 5/5 geslaagd; ZIP-hash stabiel |

Binnen de expliciet beperkte `C1`/`C2`-scope is stap 5 uitgevoerd:

- post 8079 is gepubliceerd op
  <https://calorietoken.net/2026/09/16/five-years-of-calorietoken/>;
- post 8080 staat gepland voor 17 september 17:00 UTC;
- posts 8084, 8085 en 8086 staan gepland voor 18, 21 en 23 september om
  08:00 UTC;
- de live jubileumpagina geeft HTTP 200;
- mobiele Lighthouse: toegankelijkheid 90, best practices 96 en SEO 85;
- de geselecteerde socialqueue voor 16–24 september is copy- en mediaklaar.

Externe socials zijn niet foutief als ingepland gemarkeerd: er is geen
gekoppelde publisher voor LinkedIn, YouTube, Instagram, Facebook of TikTok.
Daarom is daarvoor een exacte handmatige queue opgeleverd. De echte Xaman
sign/return, ingelogde dagboek-/WordPress-samenvatting en fysieke camera blijven
open productacceptaties; de gerichte campagne gebruikt daar geen onbewezen
resultaatclaim voor. Een latere totale publicatie-GO blijft nodig voor C3–C5 en
de rest van de oorspronkelijke review.
