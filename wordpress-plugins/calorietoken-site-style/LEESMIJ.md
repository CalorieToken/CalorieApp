# CalorieToken Site Style 1.4.37

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

Pakket: **calorietoken-site-style-1.4.37.zip**. Upload via Plugins → Nieuwe plugin →
Plugin uploaden en vervang de bestaande Site Style-plugin. Controleer daarna de
Donations-pagina en de WordPress-geplande taken. Maak een database- en bestandenback-up.

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
