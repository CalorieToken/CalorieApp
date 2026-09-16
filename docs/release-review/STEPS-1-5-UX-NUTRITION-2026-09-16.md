# Stappen 1–5 — UX en veilige Nutri-samenvatting

Status: reviewkandidaat, niet live. Productie blijft geblokkeerd tot één expliciete totale GO van Pieter.

## Wat nu overal als harde acceptatie-eis geldt

Alle vijf stappen moeten niet alleen technisch werken, maar voor een gewone bezoeker ook:

- direct duidelijk maken waar Account, Product zoeken, USDA-basisvoeding en Eetdagboek staan;
- zo weinig mogelijk dubbele uitleg, dubbele invoer en herhaalde bevestiging vragen;
- laden, leeg, succes, fout, verlopen sessie en herstel zichtbaar en begrijpelijk tonen;
- nooit oude account- of eetdagboekgegevens na uitloggen, herladen of accountwisseling laten staan;
- op 360, 412 en 1440 pixels zonder horizontale overloop bruikbaar blijven;
- toetsenbordbediening, zichtbare focus, reduced motion en RTL voor Arabisch en Urdu behouden;
- dezelfde elf weergavetalen ondersteunen: en, nl, zh-Hans, hi, es, ar, fr, bn, pt, id en ur;
- de bestaande historische huisstijl, logo's, Xaman-login en CalorieHelp behouden;
- duidelijk onderscheid maken tussen brongegevens, projectinformatie en toekomstige functies.

## Stap 1 — CalorieApp, account en eten vastleggen

Onderdeel W01–W04. De bestaande gecontroleerde appbron blijft het uitgangspunt.

- Drie herkenbare routes: verpakt product zoeken, USDA-basisvoeding en eetdagboek.
- Elk product zonder bruikbare bronfoto krijgt direct een lokale, neutrale illustratie die bij de bron past: OFF-product, USDA-basisvoeding of overig/onbekend. Ook een kapotte of niet-vertrouwde URL valt hierop terug.
- Alleen afbeeldingen vanaf exact `https://images.openfoodfacts.org/images/products/…` mogen als externe productfoto worden geladen; een afgewezen URL veroorzaakt geen externe aanvraag.
- Eén USDA-stroom: product kiezen, eetbare grammen invoeren, voedingswaarden bekijken en bewust opslaan.
- Geen tweede procentstap en geen dubbel geschaalde voedingswaarden.
- Opgeslagen USDA-items tonen werkelijke grammen.
- Productletters A–E blijven bronwaarden; ontbrekende letter blijft zichtbaar als ontbrekend.
- Het periodeoverzicht toont eerst de aantallen Open Food Facts, USDA en overig/onbekend. Alle drie tellen mee in calorieën en voedingswaarden.
- De A–E-verdeling geldt uitsluitend voor OFF-producten met een door OFF aangeleverde Nutri-Score. USDA-basisvoeding wordt niet als ‘ontbrekende Nutri-Score’ behandeld en krijgt nooit een verzonnen score.
- Bron- en scoreaantallen worden over de hele gekozen periode berekend, niet alleen over de momenteel geladen pagina van het dagboek.
- Oudere registraties die niet betrouwbaar als OFF of USDA zijn te herleiden blijven zichtbaar in totalen en staan eerlijk onder overig/onbekend.
- Zoeken, kiezen, aanpassen, annuleren, opslaan, fouten en sessieverloop hebben lokale feedback bij de handeling.
- Privélogboekstatus wordt direct gewist bij uitloggen of accountwisseling.
- Authenticatie, backend, database, wallet signing en hostingbudget worden niet opnieuw ontworpen.

Nieuw in deze afronding: de app publiceert uitsluitend een kleine geaggregeerde samenvatting naar de vertrouwde WordPress-ouderpagina. Die bevat de drie bronaantallen en de vijf OFF A–E-aantallen, maar geen voedselnamen of voedingswaarden. Bij laden, fout of uitloggen wordt een niet-beschikbare status gestuurd zodat buiten het iframe geen oude data blijft staan.

## Stap 2 — WordPress, Xaman-kaart en minimale Nutri-weergave

Onderdeel W05. De bestaande Identity Bridge 0.3.29 en Login Repair 1.0.0 worden niet vervangen. De wijziging zit in de afzonderlijk uitschakelbare Heading Repair 1.3.0-companion.

- De bestaande Xaman-login blijft de hoofdactie; er komt geen tweede login of walletstroom.
- De bestaande `ctstyle-account-app`-sectie blijft in de enige zichtbare `.xl-card` staan.
- Binnen diezelfde Xaman-kaart, maar buiten het CalorieApp-iframe, verschijnt na inloggen één compacte bron- en scoreweergave.
- Bovenaan staan OFF, USDA en overig/onbekend; daaronder staan de vijf OFF A–E-aantallen en de dekking `OFF Nutri-Score aangeleverd: bekend van OFF-producten` voor de in de app gekozen periode.
- USDA telt mee als bron en in de totalen binnen de app, maar niet in de noemer van de OFF Nutri-Score-dekking.
- De tekst zegt expliciet dat dit productaantallen zijn en geen algemene voedings- of gezondheidsscore.
- Alle elf talen en RTL worden ondersteund; de vijf vakken passen in de bestaande kaartbreedte.
- Alleen berichten uit het exacte CalorieApp-frame en de toegestane app-origin worden geaccepteerd.
- Bij uitloggen, iframe-herladen, ongeldige data of foutstatus wordt het blok onmiddellijk verborgen.
- De companion blijft bronhash-gebonden en doet niets als de geïnstalleerde Site Style onverwacht afwijkt.

### Privacygrens

| Buiten het iframe toegestaan | Nooit buiten het iframe |
|---|---|
| Aantal OFF, USDA en overig/onbekend | Productnamen of maaltijden |
| Aantal OFF A, B, C, D en E | Calorieën, macro's of andere nutriënttotalen |
| Totaal, bekende en ontbrekende OFF-productscore | Datums of losse dagboekregels |
| Gekozen periodetype | Walletadres, account-ID, token of sessiegeheim |
| Taal en toestand | Gemiddelde, afgeleide of persoonlijke gezondheidsscore |

Er is geen fetch vanuit het WordPress-blok en niets wordt in WordPress, `localStorage` of `sessionStorage` opgeslagen.

## Stap 3 — Website, CalorieHelp en toegankelijkheid

Onderdeel W06–W08.

- Website- en Helpteksten leggen dezelfde drie voedselroutes en dezelfde bronletterbetekenis uit.
- Account-, app-, Help- en taalbediening blijven herkenbaar en werken zonder elkaar af te dekken.
- Lange uitleg wordt gegroepeerd; de eerstvolgende handeling blijft bovenaan zichtbaar.
- Labels veranderen direct mee met de gekozen taal, zonder één taal achter te lopen.
- Mobiele kaarten, formulieren, footer, cookiebediening en zwevende knoppen mogen elkaar niet overlappen.
- Historische informatie blijft als historisch herkenbaar; niet-live Web3-ideeën worden niet als werkende functie gepresenteerd.

Live acceptatie op WordPress, een echte Xaman-sessie, een echt toegestaan testaccount en fysieke mobiele browsers blijft een releasecontrole, geen vooraf geclaimd resultaat.

## Stap 4 — Bewijs en complete vrije review

Onderdeel W09–W15.

- Eén doorzoekbare review bundelt de 97 bewaarde voorstellen, bestaand materiaal, nieuwe functies en correcties.
- App- en websitebeelden moeten de uiteindelijk geïnstalleerde kandidaat tonen; oude beelden blijven als oud gelabeld.
- De elf tekstversies blijven beschikbaar; ontbrekende native taal-/spraakcontrole wordt zichtbaar als open punt gemarkeerd.
- Historische voorgestelde publicatiedata worden niet automatisch ingehaald.
- Bestaande kanalen blijven leidend; Patreon blijft uitgesteld en er worden geen nieuwe betaalde diensten toegevoegd.
- Geen losse goedkeuringsformulieren per item: alles komt in één totale review.

## Stap 5 — Eén besluit, gecontroleerde release en overdracht

Onderdeel W16–W17.

Vóór de GO krijgt Pieter één samenvatting met exacte appcommit, pluginversie en ZIP-hash, testresultaten, screenshots, bekende beperkingen, live controlelijst en rollback. Pas na het expliciete woordelijke totaalbesluit worden de voorbereide productiestappen uitgevoerd.

Releasevolgorde na GO:

1. De achterwaarts compatibele backendkandidaat met periodebrede OFF/USDA/overig-aantallen uitrollen en gezondheid controleren; er is geen databasemigratie.
2. Exacte frontendcommit via de bestaande Render-service uitrollen en build-ID controleren.
3. Heading Repair 1.3.0 installeren/activeren zonder Identity Bridge, Login Repair of Site Style te vervangen.
4. Cache via de bestaande normale bediening verversen.
5. Login, logout, taal, bronverdeling, OFF A–E-samenvatting, alternatieve afbeeldingen, stale-data-verwijdering, appnavigatie, Help en 360/412/1440 controleren.
6. Alleen na geslaagde live acceptatie de complete campagnepublicatie uitvoeren.

Rollback: Heading Repair 1.3.0 deactiveren en de vorige frontend- en backenddeploy herstellen. De companion en deze bronindeling bevatten geen migratie of opgeslagen WordPress-gebruikersdata.

## Bewijs van de huidige kandidaat

- Volledige Node-regressiesuite: 303/303 geslaagd.
- TypeScript `--noEmit`: geslaagd.
- Next.js productie-build: geslaagd.
- Gerichte app-samenvattingstests: geslaagd.
- WordPress parser-/DOM-tests: geslaagd, inclusief verkeerde bron/origin, OFF/USDA/overig-consistentie, elf talen, RTL, uitloggen, iframe-herladen en behoud van bestaande Help-antwoorden.
- Heading Repair 1.3.0 ZIP: 12 bestanden, SHA-256 `5c7736741570bafd1247ef4a42d855d682e9bcbe352ef13d9d668c0ccbe6f5e5`.
- Deterministische Heading Repair-releasebuilder en native PHP-lint worden tevens in de geïsoleerde GitHub-controle uitgevoerd.

Dit document is een voorbereidings- en acceptatiecontract. Het is geen verklaring dat de kandidaat al live staat.
