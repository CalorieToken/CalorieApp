# Uitlijning en rustiger inloggen — 17 september 2026

Status: lokaal voorbereid. Niets naar GitHub geüpload, geïnstalleerd of live gezet.
De gebruiker heeft bevestigd dat de andere WordPress-update live staat. De
afstemming is afgerond; upload wacht op de bestaande toestemming per commit.

## Wat verandert

- De account- en voedingsnavigatie heeft vier gelijke knoppen: op mobiel twee
  rijen van twee, op brede schermen één rij. Accounthulp staat onder Mijn account.
  De knoppen krijgen gelijke hoogte, ook als een label op twee regels loopt.
- Dag, Week, Maand en Alle datums krijgen hetzelfde raster. Vorige, datum en
  Volgende blijven naast elkaar staan; Vandaag krijgt een eigen volledige rij.
  De pijlen spiegelen mee in talen die van rechts naar links worden gelezen.
- De aparte accountplugin presenteert het bestaande Xaman-inlogvenster als één
  paneel op de pagina. Eén korte status vervangt de vele voortgangsteksten.
  De QR-code staat achter een uitklapbare optie; fouten en Opnieuw proberen
  blijven beschikbaar. Het paneel sluit na een vertrouwd voltooiingsbericht.
  Daarbij moet het bericht bij de lopende inlogpoging horen. De oude Xaman-,
  QR- en herhaalknoppen verdwijnen meteen. Verlate voortgang of herhaling van
  die afgeronde poging kan het paneel niet opnieuw tonen. Een nieuwe poging
  kan wel starten. Bij een verlopen aanvraag blijft alleen Opnieuw proberen
  als inlogactie over.
- De bestaande Xaman-links, ondertekening, controles, sessiebeëindiging en
  WordPress-doorverwijzing blijven door de bestaande Identity Bridge afgehandeld.
  De presentatie voegt geen bevestigingsdialoog bij uitloggen toe. Een geopend
  inlogpaneel verdwijnt bij een vertrouwd uitlogbericht. In volledig scherm
  wordt de bestaande terug-naar-pagina-knop gebruikt om het paneel te tonen.
- De blijvende nickname in app en loginwidget uit de eerdere voorbereiding is
  behouden. Alle elf ondersteunde talen hebben teksten voor het inlogpaneel.

## Afstemming met WordPress

Gebaseerd op PR #146, `ae86192699ee15719f06dec4be0707deb985be83`.
De eerdere accountcommit en deze aanvullingen zijn samengevoegd in één lokale,
nog niet geüploade kandidaat. De oorspronkelijke bundel met `8774baa` is ouder.
Een geauthenticeerde alleen-lezencontrole bevestigt Heading Repair 1.6.10 live,
naast Identity Bridge 0.3.29 en Site Style 1.4.46. Het inlogpaneel gebruikt nu
hetzelfde originele vervaagde logo als de nieuwe WordPress-kaarten.
Heading Repair 1.6.10, Site Style, Identity Bridge, pagina's, titelbanners en
themaonderdelen zijn niet gewijzigd door deze aanvulling. De aanvullende
presentatie zit in Account Profile 0.1.1. De bestaande nickname-migratie en
bijbehorende backend moeten vóór installatie daarvan worden afgestemd.

## Controles en resterende onzekerheid

- De volledige geïntegreerde versie heeft 406 geslaagde Node-controles, inclusief
  behoud van de bestaande inlogknoppen en handlers, rustige voortgang, zichtbare
  fouten, afzender-/origin-/taalcontrole, afsluiten en de elf talen.
- Productiebuild inclusief TypeScript geslaagd; JavaScript-syntaxis en
  `git diff --check` geslaagd.
- Vergelijking met de genoemde WordPress-basis bevestigt dat de andere chat's
  Heading Repair-bestanden en release/workflow-bestanden intact zijn.
- De live pagina gaf in de controlebrowser tweemaal HTTP 502 met
  `Connection refused`. De lokale HTML-voorvertoning mocht niet door de
  cloudbrowser worden geopend vanwege diens URL-beleid. Er is dus geen nieuwe
  visuele browseracceptatie of screenshotbewijs; de preview is alleen een
  reproduceerbaar tussenbestand van de werkelijke componenten en productie-CSS.
- Native PHP, bestaande productie-browsercontroles en de echte mobiele
  Brave/Xaman-volgorde zijn nog niet opnieuw gevalideerd. De geïsoleerde CI is
  voorbereid maar kan pas na toegestane upload draaien.
- Aanvullende screenshot `9d520ec8-0f02-4409-ab74-e7d671021228.png` bevestigt
  de bestaande Bridge-succesmelding: “Signed in to WordPress and CalorieApp.
  Updating your account controls...”, samen met oude instructies en Open Xaman.
  De bron houdt dit venster nog 1400 ms zichtbaar voordat de accountbediening
  wordt herladen. De aanvullende presentatie sluit het nu onmiddellijk.
- Zeven gerichte paneelcontroles slagen. Daaronder draait de werkelijke
  Identity Bridge-controller samen met de nieuwe presentatie, in beide
  laadvolgordes. De test bevestigt dat het succesvenster en de oude acties
  direct onzichtbaar zijn, terwijl de bestaande verversing blijft werken.
- De screenshot maakt deze inlog-/voltooiingsmelding duidelijk. Een complete
  reeks van drie losse vensters en eventuele externe browser- of
  Xaman-bevestigingen zijn niet live gereproduceerd. Er is geen claim dat
  externe bevestigingen zijn verwijderd.

Vóór een latere upload opnieuw de PR-head vergelijken, eventuele nieuwe
WordPress-wijzigingen meenemen en de bestaande toestemming per upload volgen.
