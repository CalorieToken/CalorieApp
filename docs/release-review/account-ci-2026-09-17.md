# Accountwijzigingen: upload en CI op 17 september 2026

De goedgekeurde bestanden staan op [PR #146](https://github.com/CalorieToken/CalorieApp/pull/146)
als commit `c96c478c243c8f40f799a640a7f272494015824c`. Upload via de
gekoppelde GitHub-app gaf een ander commitnummer dan de lokale `fa1f393`.
De volledige Git-tree is aan beide kanten exact
`a9c7e02ad74c12202c638d6887badb3d076c21c6`; alle bestanden zijn identiek.
De directe ouder is de afgestemde WordPress 1.6.10-commit `ae861926`.
De PR is concept en niet gemerged. Er is niets geïnstalleerd of live gezet.

Deze status vervangt de eerdere vermelding dat de accountwijzigingen alleen
lokaal klaarstaan in de twee voorbereidende reviewdocumenten.

## Uitgevoerde controles

[Food UX-run op de geüploade commit](https://github.com/CalorieToken/CalorieApp/actions/runs/35251351549):

- 406 JavaScript-tests geslaagd.
- 340 backendtests geslaagd.
- Native PHP-syntax en Account Profile PHP-tests geslaagd.
- TypeScript en productiebuild geslaagd.
- 63 browsercontroles voltooid zonder JavaScript-fouten voordat de testroute
  vastliep. De gemaakte Nederlandse app-screenshots op 360 en 1440 pixels zijn
  bekeken: vier uitgelijnde navigatieknoppen, gelijke periodeknoppen,
  vorige/datum/volgende op één rij en Vandaag op een eigen rij.

De afzonderlijke [WordPress-opmaakcontrole](https://github.com/CalorieToken/CalorieApp/actions/runs/35251355988)
is geslaagd. De tweede Food UX-run voor het PR-event stopte bij dezelfde
testroute als de push-run.

## Gerichte correctie, nog niet geüpload

De eerste browsertest probeerde de volwassen leeftijdsknop aan te klikken
terwijl die onder Mijn account → Instellingen zit. De knop stond dus in een
verborgen scherm. De test was niet volledig aangepast aan de nieuwe navigatie.

De correctie volgt de zichtbare bediening:

- Volwassenen openen Mijn account → Instellingen voordat ze hun leeftijdsgroep
  wijzigen. De controle na terugkeren naar volwassen verwacht vier hoofdtabs.
  Kinderen en tieners behouden hun bestaande twee tabs en leeftijdsknop.
- De accounthulptest gebruikt Terug om vanuit de exportsectie weer het
  accountoverzicht met de hulproutes te openen.
- De vier afzonderlijke browserprogramma's leveren voortaan allemaal hun
  resultaat, ook wanneer één programma faalt. Elke fout blijft de CI-stap
  laten mislukken; de bestaande inhoudelijke controlevoorwaarden blijven staan.

Alleen twee browsertests, de testworkflow en dit verslag veranderen.
De app, backend en WordPress-pluginbestanden blijven gelijk aan `c96c478`.
Python-, YAML- en Bash-syntax en `git diff --check` zijn lokaal gecontroleerd.
De aangepaste browserroutes zijn nog niet uitgevoerd: daarvoor is een nieuwe
CI-run na upload nodig. De eerste run bereikte de nickname-, accounthulp- en
voedingsuitleg-browsersuites nog niet.

Volgens de bestaande afspraak wacht deze afzonderlijke testcorrectie op
toestemming voor upload. Merge, productiemigratie, uitrol en plugininstallatie
maken geen deel uit van die upload. De echte mobiele WordPress/Xaman-inlog- en
uitlogvolgorde blijft een latere acceptatiecontrole.
