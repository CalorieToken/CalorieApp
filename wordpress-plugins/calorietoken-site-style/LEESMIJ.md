# CalorieToken Site Style 1.4.1

Eén complete vervangende ZIP, 10 september 2026. Alle eerdere Site Style-correcties zijn inbegrepen; tussenversies zijn niet nodig.

## Installeren

WordPress → Plugins → Nieuwe plugin → Plugin uploaden → kies **calorietoken-site-style-1.4.1.zip** → Nu installeren → **Huidige vervangen door geüploade**. Controleer dat **CalorieToken Site Style 1.4.1** actief is en leeg de websitecache. Laat XummLogin, Identity Bridge en Content Workbench staan.

## Correctieronde 1.4.1

- Home-footer: ondersteunt de echte WordPress-weergave van de instelling. Gedeelde footer en appverwijzing verschijnen daardoor ook op Home. De titelbanner en hoofdafbeeldingen van Home blijven behouden.
- Xaman-widget: CalorieApp en elf taalkeuzes staan zichtbaar in de bestaande kaart, zowel voor bezoekers als ingelogde gebruikers. Oudere usecases krijgen dezelfde native Xaman-kaart via de bestaande shortcode, buiten het menu. De bestaande accountnodes, loginroute en handlers blijven behouden.
- Trustline: de twee werkelijk aangetroffen Brizy-rijen staan als gelijkwaardige kaarten naast elkaar; op mobiel onder elkaar. Bestaande issuer, valuta, bedrag, kopieerknoppen en ondertekenroute blijven behouden.
- Contact: zes socialmediategels met dezelfde afmetingen, afstand en mobiele indeling. De aangetroffen verkeerd samengestelde Telegram-link is gecorrigeerd.
- CAL & Crypto: één consistente inhoudsbreedte, drie duidelijke routes en de Trustline-hulp binnen de DEX-sectie. Volgorde: DEX, bestaande uitleg, SWFT.
- Donatie: verzorgde velden, samenvattingen, voortgang en knoppen bij bedragkeuze, winkelmand en afrekenen. Alleen presentatie; betaalverwerking, veldnamen, waarden en validatie blijven behouden.
- App-/Testnet-presentatie: zichtbare Calorie-logoachtergrond achter de appafsluiting en uitleg, rustigere stappenkaart en duidelijke startknop. Geen dubbele melding “klaar” bij de eerste stap.
- X: herkent de daadwerkelijke iframe die X zonder CSS-klasse invoegt. Een geladen tijdlijn houdt daardoor geen overbodige fout-/cookietoelichting zichtbaar. X bepaalt zelf welke posts worden geleverd en in welke volgorde; nieuwste-eerst is niet gegarandeerd. YouTube krijgt een korte, herkenbare videoknop; bestaande privacykeuzes blijven leidend.
- Open Food Facts en USDA krijgen op de WordPress-apppagina een vergelijkbare bron-/licentievermelding, uit dezelfde elf vertalingen als de app. USDA blijft de kleine selectie van drie referentieproducten; geen volledige zoekintegratie.
- De gedeelde menu- en footerlinklabels volgen nu dezelfde taalkeuze. Volledige vertaling van alle historische CMS-teksten, afbeeldingen met ingebakken tekst en externe inhoud is nog niet beschikbaar en wordt niet als voltooid aangemerkt.
- De CAL & Crypto-zweefknop werkt ook naast de oudere, al actieve native navigatie zonder die controller te vervangen.

## Inbegrepen

- De eerder voorbereide Gallery app-huisstijl: herkenbare headers, kopafbeelding, titelplaatsing en footers. Donatiebanner, Roadmap-verwijzing, Tokenomics-afbeelding/walletkaart, mobiele Trustline-kaarten, usecases, Blog en menucorrecties blijven inbegrepen. De geaccepteerde hoofdinhoud en header van Home blijven behouden; de gevraagde footer, appverwijzing en zwevende navigatie zijn de begrensde aanvullingen daar.
- **CAL & Crypto**: DEX → bestaande koop-/verkoopuitleg → AllChainBridge/SWFT. Het pagina-adres blijft gelijk. De XRP-uitleg noemt nu ook SWFT-routes uit bijvoorbeeld BTC/ETH, afhankelijk van actuele ondersteuning, netwerk, wallet en kosten.
- De DEX-sectie verwijst naar de externe **CAL/XRP Xaman DEX-xApp**, dezelfde bestemming als de bekende Trade-route. De eigen orderinterface is niet actief: de concrete eigen dienst heeft in het dossier geen vastgestelde MiCA-uitzondering/toelating. Ondertekenen met Xaman alleen geeft die zekerheid niet.
- SWFT vermeldt: **andere ondersteunde munten blijven beschikbaar; CAL is tijdelijk gedelist**, volgens de eigenaar. De iframe verschijnt op verzoek met bestaande cookietoestemming. Geen actuele fiat-betaalmethoden of succesvolle swap beloofd.
- **Vier eenvoudige Testnet-stappen**, één tegelijk zichtbaar, met grote knoppen: aanmaken → Testnet kiezen → in Xaman importeren → adres vergelijken en aanmelden.
- **Elf weergavetalen** in de CalorieApp-widget. De koppeling met de app is nu geïmplementeerd en in GitHub samengevoegd. De actuele appversie op Render moet wel actief zijn voordat beide kanten samenwerken.
- **Zwevende CAL & Crypto-knop**, naast de bestaande bediening. Groen, paars en geel wisselen bij aanwijzen of toetsenbordfocus. Home-, app- en exchangelinks verdwijnen op hun eigen pagina.
- **Calorie-hulp** in het bestaande appmenu en op FAQ: vaste antwoorden, zes onderwerpen en gerichte documentlinks. Geen AI-abonnement, geen vraagopslag, geen automatische tickets/e-mails. Bij onbekende vragen staan FAQ en publicaties voorop. Alleen een expliciete contactvraag toont de Contact-pagina; de hulp verstuurt zelf niets.

## Testaccount gebruiken

1. Open CalorieApp → **Proberen met testtegoed** → **Maak mijn gratis testaccount**.
2. Wacht op het test-XRP en volg de zichtbare stap om XRPL Testnet in Xaman te kiezen.
3. Kopieer de herstelcode en importeer in Xaman via **Import existing account → Full access → Family Seed**.
4. Vergelijk het accountadres en meld je aan met dit testaccount. De gewone Xaman-aanmelding blijft nodig.

De officiële XRPL Testnet-faucet maakt het account en de sleutel; dit is geen uitsluitend lokale sleutelgeneratie. De module houdt de herstelcode tijdelijk in browsergeheugen en toont/kopieert hem alleen op verzoek. Hij stuurt de code niet naar WordPress of CalorieApp en zet hem niet in URL’s of opslag. Bij verlaten van de pagina wordt de eigen weergave leeggemaakt. Importeer of bewaar de code dus eerst. Gebruik dit account nooit voor echte fondsen; Testnet kan worden gereset.

Een mislukte saldocontrole behoudt hetzelfde account. **Test-XRP controleren** controleert opnieuw zonder een tweede account te maken. Er is geen automatische herhaling van aanmaakverzoeken. Netwerkfouten/limieten geven uitleg en een link naar de officiële faucet.

Het account krijgt geen automatische appidentiteit, retailerrol of pilotinschrijving. Dit is geen test-CAL-tokenfaucet. Bestaande voedselzoekfuncties blijven zonder wallet beschikbaar. Echte faucetwerking via de hosting, Xaman-import en aanmelden met het verse account moeten op de telefoon worden gecontroleerd.

## Appwijzigingen en talen

De aanvullende zoekcorrectie in [PR #137](https://github.com/CalorieToken/CalorieApp/pull/137) voorkomt het opnieuw starten van een lopende zoekactie door herhaald klikken/Enter. Opstartuitleg en een zichtbare wachttijd na tijdelijke fouten zijn beschikbaar in alle elf talen. De wachttijd respecteert een langere Retry-After van de server; er is geen automatische nieuwe zoekopdracht bij afloop. Deze appcorrectie komt via de afzonderlijke Render-uitrol beschikbaar, niet door het uploaden van deze WordPress-ZIP. Dit heft hosting- of bronlimieten niet op.

[CalorieApp PR #136](https://github.com/CalorieToken/CalorieApp/pull/136) is samengevoegd na vier geslaagde verplichte controles. Bevat de voorbereide taalprovider, appintroductie en voedingsinterface, een eenvoudige dagboekfilter, duidelijke Nutri-Score-verdeling, de verwijzing terug naar de Testnet-stappen en een minimale USDA-referentie met drie gedateerde voorbeelden per 100 gram en CC0-bronvermelding. Er is geen USDA-API-sleutel nodig en geen nieuwe import van voorbeelden naar het persoonlijke dagboek.

Widget en app gebruiken dezelfde gecontroleerde weergavetaalkoppeling voor elf talen. Een expliciete voorkeur wordt maximaal dertig dagen onthouden. De authenticatietaal en iframe-loginparameters worden hiervoor niet gewijzigd. Een bestaande actieve native WordPress-taalkoppeling houdt voorrang. Dit vertaalt niet automatisch alle historische pagina-inhoud of juridische documenten; sommige onderdelen blijven Engels.

Deze WordPress-ZIP deployt de afzonderlijke app niet. De appcode staat op main; de actuele Render-uitrol en samenwerking op de live site zijn **nog niet bevestigd**. Bij een oude appversie blijft de website bruikbaar, maar verschijnen de nieuwe appfuncties pas na de appuitrol.

De verplichte productiecontrole ontdekte bestaande kwetsbaarheden in Next 14. Daarom bevat dezelfde app-PR Next **15.5.25** en PostCSS **8.5.23**, met de benodigde kleine routeparameter-aanpassing. React 18 blijft behouden. Productie-audit: nul gemelde kwetsbaarheden na deze correctie. De bestaande XamanLoginPanel en backend/authenticatiebron zijn niet aangepast.

## SWFT en toestemming

De bestaande Complianz-toestemming blijft leidend. Biedt de site de service-API aan, dan moet **swft** werkelijk zijn geregistreerd en toegestaan. Anders blijft de iframe dicht en is **Openen bij SWFT** beschikbaar. De plugin verzint geen cookiegegevens en overschrijft geen weigering. Intrekken van toestemming verwijdert de eigen iframe. Actuele serviceconfiguratie, walletverbinding en partner-/regiovoorwaarden zijn niet live gecontroleerd.

## Controle en herstel

De regressies controleren bestaande account-/formuliernodes en handlers, elf talen, appberichtgrenzen, privacykeuzes, Testnet-foutpaden, native WordPress-shortcodes en de nieuwe gedeelde onderdelen. De app krijgt alleen de hierboven beschreven zoekcorrectie; account- en backendcode blijven behouden. De exacte aantallen staan bij de releasecontrole.

Openbare versies van Home, Trustline, Groceries, CAL & Crypto en Contact zijn gelezen. De browser blokkeerde het openen van een lokale voorbeeldpagina; daarom is **geen visuele browsercontrole van deze nieuwe 1.4.1-versie** geclaimd. De opgeslagen echte DOM-opbouw en CSS-regels zijn wel gebruikt voor de correcties en controles. De praktijktest volgt na upload.

De controles combineren werkelijke opgeslagen pagina-opbouw met lokale/synthetische gevallen. Er is geen uitgevoerde Xaman-import/login of swap geclaimd. De hostingbeveiliging is niet omzeild. De plugin schrijft geen Brizy-bron, WordPress-instellingen of accountgegevens. Editors en historisch Home 8001 zijn uitgesloten.

Deactiveren of terugplaatsen van de vorige Site Style-versie verwijdert de toegevoegde weergave. Een extern aangemaakt Testnet-account of expliciet ondertekende ledgertransactie wordt niet teruggedraaid. De app-PR is apart terug te draaien via een GitHub-revert; de WordPress-plugin deactiveren zet de appversie niet terug.

Na upload: bekijk FAQ en de appwidget op mobiel, kies een taal in beide richtingen, test één nieuw Testnet-account tot en met Xaman-aanmelding en controleer de eerder gemelde pagina’s. Rond daarna de visuele acceptatie van stap 3 af; voor stap 4 tonen we alleen aantoonbaar werkende functies.
