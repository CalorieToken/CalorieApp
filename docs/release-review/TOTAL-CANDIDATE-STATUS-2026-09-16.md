# CalorieToken — totale kandidaat stap 1 t/m 5

Datum: 16 september 2026<br>
Status: geïntegreerde lokale review- en releasekandidaat; live omgeving is slechts gedeeltelijk bijgewerkt.<br>
Beslisgrens: één expliciete totale GO van Pieter voor externe upload, CI, deployment en live acceptatie.

## Richtlijnen van Pieter — expliciet en leidend

Deze kandidaat is getoetst aan de volgende vaste eisen. Ze mogen in een vervolg
niet stilzwijgend worden geschrapt, versmald of als ‘later’ worden behandeld:

1. Werk in volgorde 1 → 2 → 3 → 4 → 5; rond eerst 1 en 2 volledig af.
2. Neem alle eerder voorbereide functies, inhoud en bouwstenen mee; maak geen
   nieuwe concurrerende versie en laat onderdelen niet half achter.
3. Gebruikerservaring, gebruiksvriendelijkheid, overzicht, duidelijke taal en
   zo weinig mogelijk onnodige handelingen zijn acceptatie-eisen, geen extraatjes.
4. Een product zonder bruikbare foto krijgt een begrijpelijk alternatief beeld.
5. OFF en USDA worden samen overzichtelijk getoond, maar inhoudelijk correct:
   USDA krijgt geen verzonnen Nutri-Score.
6. De bestaande Xaman-login blijft de hoofdlogin. De minimale voedingsweergave
   staat in dezelfde WordPress/Xaman-kaart buiten het app-iframe als dat veilig kan.
7. Bestaande Identity Bridge 0.3.29, Login Repair 1.0.0, Site Style 1.4.46,
   historische huisstijl, logo’s, CalorieHelp en bestaande content blijven behouden.
8. Exact elf talen: en, nl, zh-Hans, hi, es, ar, fr, bn, pt, id en ur.
9. Geen persoonlijke gezondheidsscore, geen onjuiste bronclaim en geen
   toekomstige Web3-functie als al werkend presenteren.
10. Geen nieuwe betaalde dienst; Patreon blijft uitgesteld; Render blijft binnen
    het afgesproken maximum van 14 dollar per maand.
11. Geen losse goedkeuring per onderdeel en geen automatisch inhalen van oude
    publicatiedata. Eén totaalreview en daarna één totale GO.
12. ICTHendrikse wordt niet aangepast of vervangen.

## Correctie na controle van de echte live omgeving

De eerdere formulering ‘stap 1–3 afgerond’ gold voor de losse lokale kandidaat,
niet voor de totale live werking. De controle van 16 september 2026 bevestigde:

| Onderdeel | Live | Kandidaat / vereiste correctie |
|---|---|---|
| CalorieApp-frontend | `ac724aab` | featurebasis staat live; finale fallback- en samenvattingsdelta moet nog mee |
| Productiebackend | `187b8c04` | veilige WordPress-login behouden en voedingsdelta daarop integreren |
| Identity Bridge | 0.3.29 | behouden |
| Login Repair | 1.0.0 | behouden |
| Site Style | 1.4.46 | behouden |
| Heading/Language Repair | 1.1.0 | gecontroleerde companion 1.3.0 nog installeren |
| WordPress-kaart | iframe en Xaman zichtbaar | bron-/OFF A–E-samenvatting ontbreekt live |
| Showcases / FAQ / CalorieHelp | eerdere gedeeltelijke inhoud | stap-3-uitleg en visuele liveacceptatie nog uitvoeren |

De twee voorbereide jubileumberichten, WordPress-concepten 8079 en 8080, blijven
concept. Publicatie is gepauzeerd totdat stap 1–3 live zijn uitgerold en samen
zijn geaccepteerd.

De gecorrigeerde kandidaat combineert de live backendcommit `187b8c04` met de
frontend-/voedingsfeaturecommit `ac724aab`. Hun gemeenschappelijke basis is
`3845de6e`. Hierdoor blijven de eenmalige login-codes en oorsprong-/sessiegrenzen
uit de live backend behouden; een rechtstreekse backenddeploy van de losse
`ac724aab`-branch is uitdrukkelijk niet toegestaan.

## Stap 1 — CalorieApp en voedingsdagboek

Volledig in de kandidaat opgenomen:

- bestaande OFF-naam- en barcodesearch, bronhoeveelheid en portiekeuze;
- bestaande USDA-catalogusroute met FDC-nummer, bereidingsomschrijving, eetbare
  grammen, één controle en één expliciete opslaghandeling;
- periodekeuze dag/week/maand/alles, periodebrede totalen, paginering, filter,
  detail, verwijderen en duidelijke laad-/leeg-/fout-/sessiestaten;
- logout en accountwisseling wissen privé dagboekstatus onmiddellijk; late
  antwoorden mogen de oude gegevens niet herstellen;
- lokale alternatiefillustraties voor OFF, USDA en overig/onbekend bij een
  ontbrekende, afgewezen of kapotte foto, inclusief bronlabel en toegankelijke alttekst;
- externe productfoto’s alleen vanaf exact `images.openfoodfacts.org/images/products/`;
- één bronoverzicht met OFF, USDA en overig/onbekend over de volledige periode;
- alle bronnen tellen mee in calorie- en nutriënttotalen;
- A–E telt alleen brongeleverde OFF Nutri-Score-letters; USDA is niet ‘ontbrekend’
  en krijgt geen afgeleide letter;
- oudere niet-herleidbare regels blijven behouden als overig/onbekend;
- alle nieuwe bediening en uitleg in de elf overeengekomen talen, inclusief RTL.

De bronindeling gebruikt bestaande opgeslagen velden en vereist geen
databasemigratie: een OFF-log bevat de productbarcode; de vaste USDA-stroom bevat
de exacte FDC-bronmarkering zonder barcode. Niet-bewijsbare herkomst blijft overig.

## Stap 2 — WordPress, Xaman en minimale voedingsweergave

Volledig in de kandidaat opgenomen:

- Heading Repair 1.3.0 blijft een afzonderlijk deactiveerbare, bronhash-gebonden
  companion en vervangt geen bestaande login- of Site Style-plugin;
- het blok staat in `ctstyle-account-app` binnen de bestaande zichtbare Xaman-kaart;
- compacte OFF/USDA/overig-aantallen plus OFF A–E en dekking voor de in de app
  gekozen periode;
- geen voedselnamen, maaltijden, datums, calorieën, macro’s, account-ID,
  walletadres, token, sessiegeheim of persoonlijke score buiten het iframe;
- alleen het exacte CalorieApp-frame en de twee goedgekeurde origins mogen sturen;
- tellingen moeten intern kloppen: bronnen samen = totaal en bekende + ontbrekende
  OFF-score = OFF-aantal; anders wordt niets getoond;
- signed-out, laden, fout, iframe reload en pagehide verwijderen de samenvatting;
- geen fetch en geen opslag in WordPress, localStorage of sessionStorage;
- responsief op 360/412/1440, toetsenbordfocus, reduced motion en RTL;
- CalorieHelp behoudt bestaande antwoorden, stappen, links en karakter en krijgt
  in elf talen alleen de twee gecontroleerde uitlegtoevoegingen.

Deterministisch pluginpakket:

- `calorietoken-heading-repair-1.3.0.zip`
- 12 bestanden
- SHA-256 `5c7736741570bafd1247ef4a42d855d682e9bcbe352ef13d9d668c0ccbe6f5e5`
- geen migratie, setting, credential, betaalde dienst of externe call.

## Stap 3 — website, CalorieHelp en toegankelijkheid

De kandidaat sluit de nieuwe uitleg aan op de reeds voorbereide site- en
Help-structuur:

- app, USDA, bronoverzicht, alternatief beeld en OFF A–E gebruiken dezelfde betekenis;
- bronfoto en lokale illustratie worden niet met elkaar verward;
- Help blijft lokaal en bewaart geen vraaggeschiedenis;
- bestaande focusweergave, appnavigatie, taalwissel, Help-launcher, cookie- en
  footerbediening blijven gescheiden en toetsenbordbruikbaar;
- publieke documentatie labelt deze 16-septemberuitbreiding uitdrukkelijk als
  kandidaat en de 15-septemberbasis als huidige live informatie;
- fysieke mobiele sitecontrole, echte Xaman-sessie en live WordPress-visuele
  acceptatie blijven een releasecontrole na GO en worden niet vooraf geclaimd.

## Stap 4 — complete review en eerder werk behouden

De volledige review bewaart de bestaande creatieve voorbereiding:

- 97 voorstellen;
- 10 posters, 5 GIFs, 120 extra kanaalteksten en 7 bestaande gesproken-taalmedia;
- 11 nieuwe featuretekst-/campagnesets en 132 Help-onderwerpen uit R3;
- alle 214 door het reviewdocument gebruikte beeld-, video- en ondertitelpaden;
- 38 voorstellen zonder resterende controle en 59 met één of meer open controles;
- 0 publicaties geautoriseerd, 0 gepland en 0 media als vervangen gemarkeerd.

Open controles blijven zichtbaar. Ze worden niet automatisch als klaar gezet:
native redactie, uiteindelijke beeldcontrole, openbare bestemmingsmedia,
deployment/live retest, één mogelijke X-overlap en uitgesteld Patreon-werk.
Historische voorgestelde datums zijn context en worden niet automatisch ingehaald.

## Stap 5 — bewijs, één besluit en veilige release

### Lokaal geslaagd

| Controle | Resultaat |
|---|---:|
| Volledige Node-regressies | 303/303 geslaagd |
| Volledige backend-pytest | 1069 geslaagd, 24 expliciet overgeslagen, 0 mislukt |
| Gerichte login + voeding-integratie | 224/224 geslaagd |
| Python tool-/releasecontroles | 82/82 geslaagd |
| TypeScript `tsc --noEmit` | geslaagd |
| Next.js 15.5.25 productie-build | geslaagd |
| Heading Repair releasebuilder | 5/5 geslaagd en deterministisch |
| WordPress parser/DOM | opgenomen in de 303 tests; geslaagd |
| Python syntaxis nieuwe backend/browserbestanden | geslaagd |
| NPM- en Python-dependencyaudit | 0 bekende kwetsbaarheden |

De finale audit heeft twee verouderde OFF-testverwachtingen gecorrigeerd. Een
afgewezen of te lange externe afbeelding-URL houdt een verder geldig product
terecht logbaar met de lokale fallbackillustratie. De geïndexeerde OFF-fixture
gebruikt nu ook het werkelijk toegestane pad onder
`images.openfoodfacts.org/images/products/`. Productiecode hoefde hiervoor niet
te veranderen. De complete backendrun is daarna zonder fouten herhaald.
De bronpakketbouwer sluit nu bovendien testcaches, lokale virtuele omgevingen en
alle `.db`, `.sqlite` en `.sqlite3`-bestanden expliciet uit. Een nieuwe
regressietest en de lokale/GitHub-releasepoorten bewaken deze gegevensgrens.

### Eerlijk nog uit te voeren via de voorbereide CI/livepoort

- nieuw Chromium pixel-/interactiebewijs kon lokaal niet draaien omdat de
  browserbinary-download in deze werkcontainer time-outte en door de netwerkpoort
  werd geweigerd; de voorbereide workflow installeert Chromium en controleert
  11 talen, 360/412/1440, fallbacks, bronverdeling, originblokkade en stale clearing;
- native PHP-lint is voorbereid in dezelfde workflow; lokaal is geen PHP-runtime;
- GitHub-bronupload is niet uitgevoerd nadat de beveiligingspoort daarvoor
  expliciete eigenaarstoestemming vereiste. Er is geen branch, commit, PR,
  deployment of productiedata gewijzigd.

Geïntegreerde kandidaatbasis: live backend
`187b8c041ce2af093cebd5aab95b0ee689ba302a` plus frontend-/featurekop
`ac724aabf1534e51e819ef5d84df04f246eeea23`. De geïntegreerde runtime- en
pakketboom vóór deze statuscorrectie is `923d2a552df16ef642b08c7d8d9ac701b78e9b56`. Bestaande draft PR #146
blijft de canonieke route; de live backendwijzigingen moeten daarin worden
geïntegreerd en er wordt geen concurrerende app-PR gemaakt.

## Uitvoering na de ene totale GO

1. De kandidaat op de bestaande PR #146 plaatsen en exacte commit/tree vastleggen.
2. CI volledig groen: Node, backend, PHP, typecheck, build en beide browserchecks.
3. Huidige live frontend/backend en rollback-ID opnieuw uitlezen vóór deployment.
4. Achterwaarts compatibele backend deployen; geen migratie uitvoeren.
5. Frontend deployen en build-ID tegen de goedgekeurde commit controleren.
6. Heading Repair 1.3.0 installeren/activeren; Identity Bridge, Login Repair en
   Site Style niet vervangen.
7. Normale cacheverversing; echte login/logout, bronoverzicht, fallbackbeeld,
   talen/RTL, Help, 360/412/1440 en privacy-clearing controleren.
8. Bij enige afwijking: companion deactiveren en vorige frontend/backenddeploy
   herstellen; geen campagne publiceren.
9. Alleen na geslaagde live acceptatie de bewaarde campagne volgens de zichtbare
   individuele open controles verwerken; niets automatisch inhalen.

Dit document is de complete uitvoerings- en acceptatiegrens. ‘Kandidaat afgerond’
betekent niet ‘live’, ‘gepubliceerd’ of ‘campagne geautoriseerd’.
