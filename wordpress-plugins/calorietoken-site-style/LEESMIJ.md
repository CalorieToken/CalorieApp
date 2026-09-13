# CalorieToken Site Style 1.4.40

## Cookiepagina en externe inhoud

De cookiepagina houdt de oorspronkelijke Complianz-verklaring en bediening.
Op mobiel staan servicenaam en doel onder elkaar; cookievelden en categorieknoppen
passen binnen de beschikbare breedte. Op de cookiepagina springen de instellingenlink
bovenaan en de footerlink direct naar de bestaande keuzeschakelaars, zonder de pagina
te herladen. Op andere pagina's openen footer, X en SWFT dezelfde native voorkeuren.
Bij ontbrekende scripts of een door de browser verborgen toestemmingsvenster
blijft de link naar de cookiepagina werken. De update heft browserblokkeringen
niet op en verandert geen toestemmingskeuzes.

De uitleg en rechtstreekse profielverwijzing bij X blijven zichtbaar, ook als een
browser een leeg frame toont. De elf bestaande talen beschrijven deze terugval.
Wanneer X al is toegestaan, meldt de uitleg dat uitdrukkelijk.
Ingesloten X-inhoud blijft afhankelijk van toestemming, de browser en X zelf.
De bestaande toestemming, het intrekken daarvan en het beheer van externe frames
blijven bij Complianz en de al aanwezige controllers.

De automatische cookie-inventaris en de taal van de door Complianz gegenereerde
verklaring komen uit de bestaande Complianz-configuratie. Deze update verandert
geen cookieclassificaties, bewaartermijnen of juridische tekst.

## Footer

De Voting Hub staat in het Community-menu en wordt uit de footer verwijderd.
Cookie-instellingen opent rechtstreeks de voorkeuren van Complianz. Wanneer dat
script nog niet beschikbaar is, blijft de link naar het cookiebeleid bruikbaar.
Deze actie verandert geen toestemmingskeuzes.

## Voting Hub en mobiele pagina’s

De openbare Voting Hub krijgt de bestaande XPMarket-widget onder de inhoud.
De al geïnstalleerde widget verzorgt gegevens en de terugval naar XPMarket.
Een bestaande widget in de pagina-inhoud wordt niet verdubbeld.

Op mobiel verbinden lijnen en pijlen de opeenvolgende Roadmap-kaarten.
Showcases gebruikt gelijke marges en kaartbreedtes, ook rond de overgang bij
767 pixels. CAL & Crypto toont drie uitklapbare routes; de desktopinhoud blijft
uitgevouwen. Taalwissels, verwijzingen naar onderdelen en bestaande handelslinks
blijven werken. Inklappen verwijdert geen geopend SWFT-venster; de bestaande
cookie-instellingen blijven de externe inhoud beheren.

## Usecases

De beschrijvingen en het label voor toekomstig gebruik op Delivery, Cafes,
Takeaway, Restaurants, Groceries en Wholesalers volgen nu de bestaande taalkeuze.
Alle elf websitetalen zijn beschikbaar. Ook de link naar CalorieApp in deze
beschrijvingen wordt vertaald. Terugschakelen naar Engels herstelt de originele
inhoud en links.

## Donations

De donatiekaart toont ontvangen steun: een vast startbedrag plus nieuwe,
gecontroleerde donaties. Uitgaven en transactiekosten verlagen dit bruttototaal niet.
Het walletsaldo bij de laatste controle staat afzonderlijk in de toelichting.
De kaart vermeldt haar beginstand en controletijdstippen; er is geen verzonnen
streefbedrag of voortgangspercentage.

Betaalde website-donaties worden op de achtergrond gecontroleerd op het XRP Ledger.
Alleen een succesvolle, gevalideerde betaling naar de juiste bestemming telt mee;
het werkelijk ontvangen XRP-bedrag is bepalend. Herhaalde verwerking van hetzelfde
betaalbewijs verhoogt de teller niet opnieuw. Een beheerder kan een gecontroleerde
rechtstreekse bijdrage toevoegen via Gereedschap → Donatieregister. Andere
binnenkomende overboekingen tellen niet automatisch als donatie mee.

Het register blijft bewaard bij het verversen van de kaart en van de tijdelijke
walletcache. Bij een storing verschijnt een vertraagde status. Neem het register
mee in reguliere databaseback-ups. Achtergrondverwerking vereist werkende WordPress
geplande taken. De plugin wijzigt geen betaalverzoeken of betaalinstellingen.

Kaart en Caloriehelp bevatten dezelfde uitleg in de elf bestaande talen. De meter
gebruikt geen bezoekerscookies, browseropslag, audioverwerking of walletverbinding.
De weergave sluit aan bij de gedeelde websiteopmaak en ondersteunt smalle schermen.

## Installatie

Pakket: **calorietoken-site-style-1.4.40.zip**. Upload via Plugins → Nieuwe plugin →
Plugin uploaden en vervang de bestaande Site Style-plugin. Controleer daarna de
cookiepagina op mobiel en de instellingenlinks bij X en CAL & Crypto.
De afzonderlijke CalorieApp Login Repair-plugin blijft actief.

De eerdere sitecorrecties blijven inbegrepen: gedeelde Brizy-menu's en footers,
responsive paginaopmaak, Caloriehelp, Testnet-uitleg, CAL & Crypto en de bestaande
regeling voor toestemming bij externe inhoud.

## Bronnen en rechten

- [XRPL: ontvangen betalingsbedrag](https://xrpl.org/docs/concepts/payment-types/partial-payments)
- [XRPL: accountgegevens](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_info)
- [XUMM WooCommerce-plugin](https://github.com/XRPL-Labs/xumm-for-woocommerce)

De bestaande code- en bronlicenties blijven gelden. Het Caloriehelp-karakter is
met AI gegenereerd vanuit een zelfstandige beschrijving; aangeleverde illustraties
van derden zijn niet in het pakket opgenomen. Dit verleent geen rechten op die
illustraties en claimt geen exclusief auteursrecht op AI-uitvoer.
