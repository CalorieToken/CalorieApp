# CalorieToken Site Style 1.4.12

Eén complete vervangende ZIP, 11 september 2026. Alle eerdere Site Style-correcties zijn inbegrepen; tussenversies zijn niet nodig.

## Installeren

WordPress → Plugins → Nieuwe plugin → Plugin uploaden → kies **calorietoken-site-style-1.4.12.zip** → Nu installeren → **Huidige vervangen door geüploade**. Controleer dat **CalorieToken Site Style 1.4.12** actief is. Laat XummLogin, Identity Bridge en Content Workbench staan.

## Correcties op basis van livecontrole van 1.4.11

- De bestaande Identity Bridge-footer krijgt de ontbrekende Community Voting Hub-link uit het publieke WordPress-template. De bestaande rij krijgt ook de gedeelde cookieknop en vertalingen. Eigen links, social-carousel en handlers blijven dezelfde nodes; een onbekende aangepaste footer wordt behouden. Zonder gepubliceerde Hub wordt geen bestemming verzonnen.
- De exacte oude LiveCoinWatch-loader wordt in de publieke HTML onwerkzaam gemaakt voordat de browser hem kan laden. Dit gebeurt alleen op calorietoken.net als beide bestaande bridge-assets voor de sitebrede XPMarket-weergave worden geleverd. De CMS-bron en andere scripts blijven behouden; editor-, preview- en Xaman-actieverzoeken worden overgeslagen. Zonder de vervangende renderer blijft de bestaande loader staan.
- De aparte frontendcorrectie toont één taalkeuze zodra de vertrouwde website de bestaande taalsynchronisatie bevestigt. Zelfstandig of vóór die bevestiging blijft de appselector beschikbaar. De appdocumenttaal en leesrichting volgen de gekozen taal. Het taalprotocol en het Xaman-protocol veranderen niet.

De footerfout en dubbele taalkeuze zijn vóór de correctie automatisch gereproduceerd. De taal- en footercontroles testen tevens behoud van bestaande bediening. De loadercontrole gebruikt de WordPress-parserinterface met nagebootste script-attributen; de echte Brizy-/WordPress-uitvoer moet na installatie worden bevestigd. De filterpunten volgen [Brizy's publieke uitvoer](https://github.com/ThemeFuse/Brizy/blob/master/public/main.php); de gerichte HTML-aanpassing gebruikt [WordPress HTML Tag Processor](https://developer.wordpress.org/reference/classes/wp_html_tag_processor/).

De livecontrole vooraf omvatte 25 publieke URL's in desktop-Chrome met Site Style-assets 1.4.11 en Identity Bridge-assets 0.3.29. Dit pakket verandert de bridge niet en mag de live bridge niet vervangen door bronversie 0.3.18. Er is nog geen liveacceptatie van 1.4.12, fysieke camera- of nieuwe Xaman-ondertekenproef. De frontendcorrectie, scanner, USDA-gewichtskeuze en Nutri-Score-aanpassingen vragen een afzonderlijke appuitrol; deze ZIP installeert alleen Site Style. Onderstaande eerdere audit- en browserstatus is historisch.

## Gerichte Blog/X-controle 1.4.11

- Een aangetoonde herhalingslus tussen de X-laadstatus en de verborgen cookieknoppen is verwijderd. Statusberichten worden alleen bij een echte verandering verstuurd; ongewijzigde zichtbaarheid wordt niet opnieuw geschreven.
- De bestaande X-hulp en cookiebediening verschijnen op zowel `/index.php/blog/` als `/blog/`, met dezelfde elf talen.
- Een vervangen blogblok krijgt een eigen laadcyclus en controle; de oude controle en timer worden opgeruimd. Eerdere late antwoorden kunnen de nieuwe cyclus niet stilzetten.
- Na een laadfout blijft het intrekken van toestemming ook werken voor later aangeleverde inhoud. Reeds aanwezige CMS-/Complianz-iframes blijven onder hun bestaande beheer.
- Ook een vervangende X-link kan na het intrekken en opnieuw geven van toestemming weer worden gevonden, wanneer de gedeelde X-library al eerder is geladen. Er wordt geen tweede library toegevoegd.

Acht nieuwe DOM-scenario's controleren deze samenwerking, waaronder zes gereproduceerde regressies. De lustest gebruikt echte DOM-mutatiewaarneming met een begrensde foutdetectie, zodat een defect de testrunner niet kan laten vastlopen. De reparaties wijzigen geen CSS, websitevormgeving, loginprotocol of appcode. Ze omzeilen geen cookietoestemming en garanderen niet dat X zelf altijd berichten levert.

De automatische review leidde bovendien tot een numerieke controle van cookie-transparantie. Gelijkwaardige nulnotaties worden als volledig transparant herkend, zowel op de banner als op zijn container; positieve transparantiewaarden houden de bestaande bannercontrole actief. De aanvullende regressie is vóór de correctie gereproduceerd. Dit is defensieve compatibiliteitscontrole, geen gemeten fout in een specifieke mobiele browser.

De eigenaar meldt dat 1.4.10 is geïnstalleerd. Deze nieuwe ronde kon geen verse livebeelden maken: de cloudbrowser gaf opnieuw verbindingsfouten, ook na een begrensde herstelpoging. Daarom is installatie van 1.4.10 niet onafhankelijk bevestigd en is er geen mobiele of crossbrowser-goedkeuring. De hieronder bewaarde livebeelden betreffen 1.4.9. De afzonderlijke appuitrol en resterende livecontroles blijven open.

## Inbegrepen: correcties 1.4.10 na livecontrole van 1.4.9

- Op brede desktops vanaf 1200 px staan de zwevende snelknoppen aan de rechterrand, zodat ze de CAL-gids en Trustline-uitleg niet bedekken. De bestaande knopvormen, kleuren, maten en de tablet-/mobiele layout blijven behouden.
- De exacte bestaande Trustline-toelichting wordt hergebruikt en vertaald; zij verschijnt niet meer dubbel. Eigen CMS-tekst, links en handlers blijven behouden, ook wanneer het beheerde onderdeel wordt verwijderd.
- Na een expliciete klik op ‘naar beneden’ wordt maximaal 1,8 seconde rekening gehouden met laat geladen pagina-inhoud. Handmatig scrollen, aanraken, toetsenbordgebruik of verlaten van de pagina stopt die aanvulling direct. De oorspronkelijke bediening blijft actief.

Home, Whitepaper, Cafés, CAL & Crypto, Trustline, Tokenomics, Roadmap en de Richlist-header zijn live met 1.4.9 bekeken in Chrome op 1363×936. De correcties hierboven zijn vervolgens met gereproduceerde regressies getest. De cloudbrowser bood geen andere viewport/engine en verloor later de verbinding; er wordt geen mobiele, Safari-/Firefox- of na-installatiecontrole van 1.4.10 geclaimd. De appuitrol blijft afzonderlijk. Er is geen handmatige debugronde van tussenversies nodig.

## Inbegrepen: extra regressie-audit 1.4.9

- De bestaande gecombineerde CalorieApp-/taalbediening wordt teruggeplaatst als de native accountwidget zijn footer vernieuwt. De inlogknop en zijn handlers blijven dezelfde nodes.
- Een nieuwe bekende CMS- of donatiemelding wordt opnieuw vertaald, ook als de vorige tekst al vertaald was. Terug naar Engels herstelt de nieuwe tekst; onbekende eigen wijzigingen blijven behouden.
- Ook een WordPress-voorbeeld van Home krijgt geen publieke opmaakcorrecties.
- De bijbehorende appcorrectie negeert late verwijderantwoorden na uitloggen of verlaten van de pagina. Een oude foutmelding kan een nieuwe ingelogde sessie niet meer wissen.
- Voedselzoeken slaat verkeerd gevormde bronrecords over. Aangeboden producten moeten binnen de bestaande dagboekregels passen; de bronidentiteit wordt niet ingekort. Booleans gelden niet als gemeten voedingswaarden.
- De CI ontdekt nu alle JavaScript-testbestanden automatisch. Extra DOM-tests controleren de samenwerking van header, accountwidget, CAL-gids, Trustline en vertalingen. De echte decoder leest vier soorten synthetische barcodebeelden; extra bedieningstests controleren stoppen, taalwissels, weigeren en late antwoorden.

Dit is één vervangend pakket; installatie of handmatig testen van tussenversies is niet nodig. Alle 1.4.8-functies hieronder zijn inbegrepen. De automatische controles vervangen geen bewijs van de werkelijk geïnstalleerde website of de camera op een echte telefoon. De appcorrecties vragen nog steeds de afzonderlijke frontend- en backenduitrol; deze ZIP installeert uitsluitend Site Style.

## Inbegrepen: reviewronde 1.4.8

- Brizy- en usecase-headers delen nu dezelfde logobreedte, menuruimte, buitenmarges en mobiele afronding. Het usecase-menu opent in de pagina en bedekt de accountwidget niet meer.
- De volledige Xaman-/CalorieApp-kaart kan meegroeien; lange tekst, adresregels, appknop en taalkeuze blijven binnen de beschikbare breedte. De oorspronkelijke inlogbediening blijft intact.
- Footerlinks en cookieknop delen lettertype, regelhoogte en aanraakruimte. De huidige navigatiepagina is herkenbaar.
- CAL & Crypto krijgt drie korte stappen, een ingang naar CalorieApp en de whitepaper. Externe markten blijven herkenbaar; er wordt geen eigen orderdienst geactiveerd.
- Alleen de ene bestaande iframe op de echte CalorieApp-pagina krijgt cameradelegatie voor zijn gecontroleerde app-oorsprong. Er wordt geen camera gestart en een expliciete bestaande camerabeperking wordt niet overschreven.

**Afzonderlijke app-uitrol:** de nieuwe barcodescanner, exacte Open Food Facts-opvraag, USDA-gewichtberekening en Nutri-Score-kleuren vragen uitrol van de bijbehorende appcode. De barcodefunctie vereist zowel de frontend als de backend uit deze PR. Deze ZIP installeert uitsluitend Site Style. De Identity Bridge en accountkoppeling zijn niet gewijzigd.

De uiteindelijke livecontrole betreft Home, Whitepaper, Cafés, Richlist, Trustline, CAL & Crypto, Tokenomics, Roadmap, Blog en donaties, plus de afzonderlijk uitgerolde app. De extra audit vraagt geen tussentijdse handmatige controles van de eigenaar.

## Historisch: auditronde 1.4.7 — basis behouden, review eenvoudiger

Deze versie bevat alle eerdere screenshotcorrecties van 1.4.6, inclusief de gekleurde footer-terugval en het CalorieHelp-vraagteken. Je hoeft 1.4.6 niet eerst te installeren.

- Het bestaande mobiele Brizy-menu meldt zijn open/dicht-status en sluit met Escape; hetzelfde geldt voor het usecase-menu. De oorspronkelijke menu- en inlogknoppen blijven behouden.
- De oude XUMM DEX-tooltip wordt verwijderd wanneer de Trade-link al naar CAL & Crypto wijst.
- De losse lege donatiemelding kan de bestaande vertaling volgen. Wijzigingen in accountkaarten en andere uitgesloten onderdelen veroorzaken geen onnodige volledige vertaalscan meer.
- WordPress-voorbeelden en bewerkmodi worden ook aan de serverkant van de vormgeving uitgesloten.
- Onder **Gereedschap → CalorieToken review** staat een alleen voor beheerders toegankelijke inventaris van pagina’s en berichten, inclusief ongepubliceerde titels en herkenbare oude verwijzingen. Download desgewenst het privé-reviewbestand. Dit wijzigt of publiceert niets. De inventaris scant gewone WordPress-inhoud; Brizy-opmaak, afbeeldingen en externe bestemmingen vragen nog beoordeling.
- De repository bevat nu een herhaalbare Site Style-pakketbouwer en CI-controles voor bronbestanden, versies, ZIP-inhoud en toegang tot het reviewoverzicht.

**Nutri-Score:** de kleuren zijn voorbereid in de afzonderlijke CalorieApp-code. Deze WordPress-upload rolt de app niet uit. De bestaande Identity Bridge en backend blijven ongewijzigd.

**Test na upload:** bekijk Home, Whitepaper en een usecase met het menu dicht/open; Richlist ingelogd/uitgelogd; CAL & Crypto, Trustline, Tokenomics, Roadmap, Blog met jouw X-toestemming en de lege donatiemelding. Doe dit op desktop en telefoon. Het rapport legt de nog open inhouds- en releasepunten vast voordat stap 4 als live showcase kan worden afgetekend.

## Correctieronde 1.4.6 — desktopreview en mobiele aanvullingen

- Ronde gedeelde headers, een hamburger op mobiele usecases en geen vierkant achter het Home-menu. Bestaande menu- en accountbediening blijft staan.
- Rustigere CAL & Crypto- en Trustline-indeling; de directe Xaman-route staat vooraan, twee alternatieven zijn inklapbaar.
- Consolidatiewallet sluit aan op de oorspronkelijke grijze panelen, groene titel en donkere knoppen. Het adres, de explorerlink en alle toelichting blijven behouden.
- Roadmap krijgt een passende appverwijzing en een leesbare tekstknop voor de uitleg.
- Accountkaart laat lange wallettekst doorlopen; de lege donatiemelding gebruikt de huisstijl.
- Blog herkent de werkelijke X-iframe en houdt hulp zichtbaar bij een iframe van nul pixels. De bezoeker kan X expliciet toestaan via Complianz; toestemming wordt niet automatisch aangepast.
- CalorieHelp gebruikt een vraagteken, ook op mobiel. De aparte CalorieApp-knop behoudt het applogo.
- Reviewbevinding opgelost: een verborgen Complianz-container houdt de zwevende bediening niet langer onterecht verborgen.

**Afzonderlijke appwijziging:** de gekleurde A–E-balk is hersteld bij producten en de ingelogde dagboekverdeling. Productscore en aantallen blijven brongegevens; ontbrekende scores worden niet ingevuld. Hiervoor moet de frontend apart worden uitgerold. De WordPress-ZIP doet dat niet.

**Acceptatie:** deze correcties moeten na installatie nog op desktop en mobiel, ingelogd en uitgelogd, worden nagekeken. Volledige historische vertaaldekking, CMS/linkcontrole en de echte Xaman/Testnet-telefoonproef blijven open. Deze release betekent geen volledige aftekening van stap 3.

## Reviewafronding 1.4.5

Deze versie bevat alle correcties van 1.4.4. De cookiebewaking volgt klasse- en stijlwijzigingen uitsluitend op de herkende Complianz-elementen; wijzigingen elders op Brizy-pagina's activeren die bewaking niet. Laat laden, vervangen en terugkeren via de browser blijven ondersteund. Een afgeronde openbare zoekvoorbereiding geeft in de afzonderlijke appupdate ook zijn annuleringcontroller vrij. Zoeken en login behouden hun bestaande verzoeken en limieten. De pluginupload rolt de appupdate niet uit.

## Correctieronde 1.4.4 — 29 screenshots en negen opmerkingen

De laatste reviewcorrectie herkent beide bestaande toestanden van de X-profielkoppeling. De zwevende knoppen volgen de zichtbaarheid van de cookiemelding via een expliciete paginaklasse, ook bij laat laden en terugkeren met de browser. Dit gebruikt de bestaande toestemmingskeuze en vereist geen CSS `:has()`.

- Home-menu en logovlak krijgen een ondoorzichtige achtergrond. De bestaande Home-titelbanner blijft behouden.
- De consolidatiewallet gebruikt de grijze papierkaart, groene titelstrook en afgeronde onderkant van de bestaande walletpresentatie. Adres, explorerlink en volledige toelichting blijven staan.
- De acht roadmaponderdelen krijgen op mobiel dezelfde volledige breedte. De appverwijzing past binnen de tijdlijn en is geen afwijkende ingesloten kaart meer.
- De X-toestemmingsknop kan niet meer tegelijk de profiel-link openen. Complianz blijft de toestemming afhandelen. Cookie-instellingen staan ook in de footer. De echte X-timeline is op 10 september na toestemming op de huidige website gezien.
- Extra ruimte tussen Contact-team en XPMarket; dezelfde kleurrijke afsluitstrook onder iedere herkende footer.
- Op mobiel staan de zwevende knoppen in één compacte rij. Het CalorieApp-menu opent via het herkenbare appicoon. Footer en formulieren krijgen onderruimte; bediening verdwijnt tijdens de cookiemelding.
- Aanvullende vertaling van de getoonde Home-teksten, XPMarket-labels, X-kop en winkelstappen. Dit vertaalt geen providergegevens of tekst in afbeeldingen.

**Afzonderlijke appupdate:** de bijbehorende GitHub-wijziging bevat 40 inlogteksten en meldingen in elf talen, minder geneste mobiele witruimte en vroegere openbare zoekvoorbereiding. Voorbereiding en de eerste zoekactie delen één gezondheidscontrole. Er wordt niets automatisch gezocht of aangemeld. Deze appwijzigingen vereisen een Render-uitrol; het uploaden van deze ZIP voert die niet uit.

**Resterende acceptatie:** upload deze versie en controleer de zichtbare pagina's op de telefoon. De productiebuild en gerichte softwarecontroles zijn geen mobiele live acceptatie. Een terugkerende anonieme zoekfout is op de huidige app gereproduceerd; vroegere voorbereiding heft een hosting- of bronstoring niet op. Verdere Render-diagnose/uitrol was in deze ronde door de automatische toegangscontrole geblokkeerd. Een volledige taalcontrole van historische CMS-inhoud en de echte Xaman/Testnet-telefoonproef blijven open.

Onderstaande oudere release-notities bewaren de voorgeschiedenis; bovenstaande versie is leidend.

## Gerichte correctie 1.4.3 — echt app-adres

De live controle na installatie van 1.4.2 liet zien dat de ingesloten app `https://app.calorietoken.net` gebruikt. De weergavetaalkoppeling herkende alleen het eerdere Render-adres. Deze versie herkent beide exacte HTTPS-adressen en verstuurt taal- en Testnet-uitlegberichten uitsluitend naar de ene bestaande app-iframe en zijn werkelijke oorsprong. Vreemde adressen, extra iframes en berichten van andere vensters blijven uitgesloten. De login, accountgegevens, transacties en paginaopmaak worden niet aangepast.

De bestaande Render-frontend is op 10 september bijgewerkt naar de gecontroleerde appcommit `c3c9a88bdced3e9d6dd958f1dd7cbe126410ab49`. De USDA-naslag en Nederlandse appbediening zijn daar live gezien. Deze WordPress-correctie moet nog worden geïnstalleerd om de koppeling met die app live te kunnen bevestigen. Volledige CMS-vertaling en de telefoonproef met Xaman blijven afzonderlijke restpunten.

## Correctieronde 1.4.2 — opmerkingen na de upload

- CAL & Crypto: directe CAL/XRP-orderboek- en swaplinks naar XPMarket. Sologenic en generieke XRP Toolkit-handelslinks zijn verwijderd. De onbetrouwbare Xaman DEX-paarlink wordt niet meer gebruikt; de bestaande Trade-link in de accountkaart opent CAL & Crypto. Login, walletgegevens en ondertekenen blijven bij de bestaande plugins.
- Trustline: rechtstreeks via de website naar Xaman staat bovenaan. De aparte route via xrpl.services is als alternatief herkenbaar. Handmatige XRP Toolkit-uitleg is inklapbaar; aangetroffen dubbele kopieerknoppen worden niet dubbel getoond.
- Achtergrond: één doorlopend Calorie-patroon met dezelfde schaal. De Home-titelbanner, kleurrijke header en historische afbeeldingen blijven behouden.
- Tokenomics: rustigere consolidatiewalletkaart met de bestaande kleuren, afgeronde randen, leesbaar adres en behoud van de volledige toelichting.
- Roadmap: het defecte YouTube-blok is vervangen door een CalorieApp-kaart. De historische video blijft bereikbaar via een gewone YouTube-link; er wordt daar geen iframe meer geladen.
- Contact: team en XPMarket-blok hebben eigen ruimte in de documentstroom, inclusief mobiele stapeling.
- FAQ: elf inklapbare oorspronkelijke vragen met vertaling van vraag én volledig antwoord in elf talen. De bestaande hulp staat erbij. Een gemiste correctie van een samengevoegde alinea is hersteld.
- Vertaling: een eerste lokale catalogus voor bestaande paginatekst, zonder externe vertaaldienst. Bekende formulierlabels, donatie-uitleg, koppen en plugintekst volgen de bestaande taalkeuze. Bedragen, veldnamen, nonces, walletadressen en ingevoerde gegevens worden niet vertaald.
- Blog: rustigere artikeltypografie; Nederlandse vertaalteksten voor de tien historische artikelen en hun contextnotities. Historische claims blijven als historische inhoud herkenbaar.

**Dekking:** de catalogus bevat 589 bronregels: 283 met alle tien vertalingen naast Engels, plus 306 extra Nederlandse bronregels, hoofdzakelijk historische artikelen. Dit is geen volledige vertaling van alle CMS-inhoud in elf talen. Nieuwe of afwijkende brontekst blijft staan. Ingebakken tekst in afbeeldingen en externe iframes wordt niet vertaald. De overige vertalingen en de live acceptatie blijven open; stap 3 is niet volledig afgetekend.

**CalorieApp:** deze update wijzigt uitsluitend de WordPress-plugin. De eigenaar heeft de app zelf nog niet getest. De afzonderlijke appwijzigingen uit PR136/137 blijven behouden; succesvolle live appacceptatie wordt niet geclaimd.

## Aanvullingen uit de laatste controle

- Compactere desktopnavigatie volgens de usecases; bestaande accountnodes blijven behouden. Op usecases krijgt de native widget de Home-kleuren.
- Het lege strookje onder de usecase-footer gebruikt de huidige kleurrijke headerachtergrond.
- Privacy, Terms en overige herkende juridische pagina's krijgen de gedeelde header, titelbanner, leesbare inhoudskaart en footer.
- De Privacy/Terms-bron wordt eenmalig bijgewerkt van V1 naar V2 en aangevuld met de huidige integraties, alleen bij herkende oude bron en na opslag van de exacte oorspronkelijke tekst in WordPress. Afwijkende operatorinhoud wordt behouden en gemeld.
- Een **nieuwe informatieve Community Voting Hub** verschijnt op `community-voting-hub-info`, met de twee historische beelden. Er zijn geen actieve stemmen, voorstellen of beloningen. De oorspronkelijke Brizy-conceptpagina 7699 blijft ongewijzigd en wordt niet gepubliceerd. Een bestaande publieke pagina op de nieuwe route wordt niet overschreven.
- De footer toont de hub-link pas wanneer de nieuwe pagina werkelijk gepubliceerd is. Open na de plugin-update één keer het WordPress-dashboard; de beperkte publicatieactie loopt voor een beheerder met publicatierechten.
- De twee XPMarket-links volgen ook de taalkeuze. Algemene vertaalregels zijn beperkt van 261 naar 33; overige tekst wordt alleen aan de toepasselijke pagina's meegegeven.
- Whitepaper v4.2 gebruikt de originele historische achtergrond op hogere resolutie en scherp ingebedde tekst. Eerdere gedateerde PDF's blijven intact.

De nieuwe publieke aanvullingen zijn Engelstalig. Dit valt onder de nog open vertaaldekking; een taalkeuze bewijst geen complete vertaling van iedere pagina.

## Inbegrepen

- De eerder voorbereide Gallery app-huisstijl: herkenbare headers, kopafbeelding, titelplaatsing en footers. Donatiebanner, Roadmap-verwijzing, Tokenomics-afbeelding/walletkaart, mobiele Trustline-kaarten, usecases, Blog en menucorrecties blijven inbegrepen. De geaccepteerde hoofdinhoud en header van Home blijven behouden; de gevraagde footer, appverwijzing en zwevende navigatie zijn de begrensde aanvullingen daar.
- **CAL & Crypto**: DEX → bestaande koop-/verkoopuitleg → AllChainBridge/SWFT. Het pagina-adres blijft gelijk. De XRP-uitleg noemt nu ook SWFT-routes uit bijvoorbeeld BTC/ETH, afhankelijk van actuele ondersteuning, netwerk, wallet en kosten.
- De DEX-sectie verwijst naar het **CAL/XRP-orderboek en de swap op XPMarket**. De eigen orderinterface is niet actief: de concrete eigen dienst heeft in het dossier geen vastgestelde MiCA-uitzondering/toelating. Ondertekenen met Xaman alleen geeft die zekerheid niet.
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

De regressies controleren bestaande account-/formuliernodes en handlers, elf talen, appberichtgrenzen, privacykeuzes, Testnet-foutpaden, native WordPress-shortcodes en de nieuwe gedeelde onderdelen. Deze release wijzigt geen app-, account- of backendcode; de eerdere zoekcorrectie blijft behouden. De exacte aantallen staan bij de releasecontrole.

Openbare versies van Home, Trustline, Groceries, CAL & Crypto en Contact zijn gelezen. De browser blokkeerde het openen van een lokale voorbeeldpagina; daarom is **geen visuele browsercontrole van deze nieuwe 1.4.2-versie** geclaimd. De opgeslagen echte DOM-opbouw en CSS-regels zijn wel gebruikt voor de correcties en controles. De praktijktest volgt na upload.

De controles combineren werkelijke opgeslagen pagina-opbouw met lokale/synthetische gevallen. Er is geen uitgevoerde Xaman-import/login of swap geclaimd. De hostingbeveiliging is niet omzeild. De plugin schrijft geen Brizy-bron of accountgegevens. De eenmalige publicatieactie schrijft de twee herkende juridische pagina's, de nieuwe informatieve pagina en eigen herstel-/statusopties. Bestaande plugininstellingen en authenticatie blijven behouden. Editors en historisch Home 8001 zijn uitgesloten.

Deactiveren of terugplaatsen van de vorige Site Style-versie verwijdert de toegevoegde weergave. De gepubliceerde pagina en juridische broncorrecties blijven bestaan. De originele juridische tekst staat in de eigen WordPress-opties `ctstyle_public_pages_142_before_531` en `ctstyle_public_pages_142_before_586`; vergelijk deze met latere handmatige wijzigingen voordat die tekst wordt hersteld. De nieuwe hub kan via Pagina's weer op Concept worden gezet. Een door de beheerder ingetrokken of verwijderde hub wordt niet opnieuw gepubliceerd. Een extern Testnet-account wordt niet teruggedraaid. De afzonderlijke appversie verandert niet door de WordPress-plugin te deactiveren.

Na upload: bekijk FAQ en de appwidget op mobiel, kies een taal in beide richtingen, test één nieuw Testnet-account tot en met Xaman-aanmelding en controleer de eerder gemelde pagina’s. Beoordeel daarna de nieuwe weergave en de nog open vertaaldekking. Voor stap 4 tonen we alleen aantoonbaar werkende functies.

## Gecontroleerde handelsbestemmingen

- [XPMarket CAL/XRP-orderboek](https://xpmarket.com/dex/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP)
- [XPMarket CAL/XRP-swap](https://xpmarket.com/swap/Calorie-rNqGa93B8ewQP9mUwpwqA19SApbf62U7PY/XRP/market)
- [Xaman xApp-documentatie](https://docs.xaman.dev/environments/xapps-dapps) biedt geen hier bevestigde contractuele DEX-paarlink.
- [XRP Toolkit-orderhandleiding](https://docs.xrptoolkit.com/place-and-cancel-orders) beschrijft handmatige paarselectie.

De broncontrole bevestigt de bestemming, geen uitgevoerde handel of transactie.

## Rechten van teksten en beelden

De GPL-licentie van de component betreft de programmacode. Historische websiteartikelen, vertalingen daarvan, handelsmerken en beelden behouden hun bestaande rechten; dit pakket verleent daarvoor geen nieuwe licentie.
