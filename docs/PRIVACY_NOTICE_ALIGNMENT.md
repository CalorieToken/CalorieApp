# CalorieApp privacy-notice alignment record

Status: canonical product facts and eleven-language export, import and erasure
consequence copy are aligned. A complete public privacy notice, controller and
provider details, linguistic/legal review, publication and production
activation remain release-blocking.

## Purpose of this record

This document prevents the privacy notice, CalorieApp interface and durable-
data contracts from silently describing different behavior. It records the
facts that future approved notices must preserve without claiming that this
repository change is legal certification or a published privacy notice.

The machine-readable source is
`contracts/data-safety/v1/privacy-notice-alignment.json`. Contract tests compare
its selected values with `data-safety.json`, the eleven-locale registry and the
localized export, import and erasure copy contract.

## Canonical product facts

- The private account export is available only to the authenticated user. It
  may contain the internal account record, linked identity and optional XRPL
  address, owned food history, session timing and directly owned login-handoff
  activity. It also includes any inactive-account warning lifecycle timestamps
  and provider-neutral channel key. Security secrets and the keyed delivery-
  evidence digest are excluded, and legacy authorization activity without
  direct ownership is withheld.
- CalorieApp does not send the downloaded export to another service and the
  download does not itself delete server data.
- Private import remains disabled by default and rejects production. If later
  approved for one exact reviewed staging build, it accepts only the signed-in
  destination account, requires exact source and destination confirmations and
  requires a new target to have no food-log records. Only private food-log
  snapshots are imported. Identity links, sessions, authorization activity,
  browser handoffs, inactive-account notices and source database row IDs are
  not restored. The uploaded export is not retained as a file.
- Direct account erasure remains disabled by default. If separately approved
  and enabled, a confirmed request removes directly owned primary-store data
  immediately, with no app recovery window. Encrypted backups may retain a
  protected copy for no more than 30 days, subject to provider and restore-
  replay proof.
- CalorieApp erasure does not erase a separate WordPress or Xaman account,
  public XRPL records or third-party source data.
- The selected inactive-account policy is 24 months of inactivity with a
  required 30-day advance warning. Authenticated activity during the warning
  cancels pending erasure. A durable activity marker and private-export field
  are prepared in the repository. A minimal notice-evidence schema and same-
  transaction activity cancellation are also prepared without storing a raw
  contact destination or provider receipt. They have not been migrated or
  proved on staging or production. No delivery channel or provider is selected;
  warning delivery and automatic enforcement are not implemented or enabled.
- Shorter operational lifetimes continue to apply to authentication
  transients, with a selected ceiling of 30 days after expiry. Complete
  scheduled cleanup is not yet implemented.
- Personal data must not be placed on a public blockchain or public IPFS.

## Eleven-language consequence copy

The authenticated interface now explains the most immediate export, import and
deletion consequences in all eleven registered locales. The source-locale
sentences remain locked to the canonical facts, every locale must provide every
copy key, unsupported locales fall back to English, and Arabic and Urdu use
right-to-left rendering. Automated evidence guards completeness and prevents
the translated controls from silently reverting to English-only behavior.

This is machine-assisted product copy and has not received independent
linguistic or legal/privacy approval. It is not a substitute for the complete
privacy notice required before onboarding, and the unavailable independent
review does not block ordinary five-step-plan development or require repeated
process-exception prompts. Publication and production activation remain
separate explicit operator decisions.

## Still required before publication or activation

Human review must still approve and supply:

1. the controller's exact legal identity and contact route;
2. the purpose and legal basis for each processing activity, including an
   explicit assessment of whether any nutrition or profile use involves health
   or another special category and which additional condition would apply;
3. whether a data-protection impact assessment or age/child-specific safeguards
   are required;
4. all processors, recipient categories and any international-transfer
   safeguards;
5. the complete access, correction, erasure, restriction, objection,
   portability, applicable consent-withdrawal and complaint information;
6. whether data must be provided, the consequences of not providing it, and
   any automated decision-making or profiling information that applies;
7. provider-specific storage, encrypted-backup and restore wording;
8. a working data-subject request and escalation route;
9. operator-reviewed wording in all eleven registered locales and, when it
   becomes available, independent linguistic/legal review; and
10. explicit publication, migration and deployment approval.

Unknown legal, provider or contact details must remain visibly pending. They
must never be invented, inferred from repository metadata or replaced by a
claim that the English product copy is a complete notice.

## Official reference boundary

The alignment contract records requirements from the official text of
Regulation (EU) 2016/679, including Article 9's special-category boundary,
Article 12's clear-language standard, Article 13's transparency information,
Article 15's access right and Article 17's erasure right and exceptions:

- <https://eur-lex.europa.eu/eli/reg/2016/679/oj>

This record is an engineering control, not independent legal advice or
certification. It publishes nothing, changes no feature flag, performs no
migration or deployment and mutates no live personal data.
