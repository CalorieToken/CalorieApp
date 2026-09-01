# Source-neutral assertion catalog

Status: schema foundation, read-only evidence export and bounded internal
assertion ingest are implemented with synthetic proof. No public catalog write
or read API, assertion moderation or additional food source is enabled.

## Neutral identities and reviewable links

Migration `20260831_0008` adds `food_product`,
`food_product_source_link` and `food_attribute_assertion`. A product is only an
internal source-neutral identifier; it does not contain a provider-owned name or
silently promote one source to canonical status.

Each assertion must reference the exact product/source-record pair in a
reviewable link. The database rejects an assertion whose record is linked only
to another product. Match confidence and review status are constrained, and the
catalog tables contain no raw payload, email, session, wallet, IP address or
private CalorieApp user identifier.

## Conflict and correction retention

Assertions store a source record, attribute key, value, value type or unit,
observation time, verification status and positive verification version.
Different sources can therefore retain different values for the same product
and attribute without overwriting one another.

A correction is a new assertion row that may reference an earlier assertion for
the same product and source record. The database rejects cross-product or
cross-record correction lineage, and the prior row remains present. Migration
`20260831_0009` adds only a bounded internal write service for new quarantined
version-1 assertions with validated lineage. Correction and assertion-moderation
services remain absent; direct catalog-table writes remain forbidden outside
reviewed migrations and test fixtures. See `SOURCE_ASSERTION_INGEST.md`.

## Licence-aware evidence

The internal read-only evidence query returns every assertion separately with
its source key, licence identifier, terms reference and attribution text. It
does not flatten incompatible sources or select a universal truth. Any later
public presentation or export still requires a deterministic display policy
and source-specific licence review.

Synthetic tests prove that two conflicting values both survive with their own
reuse evidence and that a later correction preserves the earlier assertion.
They also prove that adding or correcting catalog assertions does not rewrite a
private `food_log` snapshot.

The internal ingest path applies versioned content policy `1.0.0` before any
database work. Its initial scope is a reviewed set of source-neutral numeric
nutrition values per 100g; arbitrary text and unknown attributes are rejected.
See `SOURCE_ASSERTION_CONTENT_POLICY.md`. Extending that scope remains a human
review decision and does not automatically enable a source or public route.

## Deliberate non-claims

This foundation does not implement public contributions, assertion correction
or moderation, a public catalog endpoint, source activation or licence approval.
The ingest audit covers admission only and is not a moderation decision. The
combined contribution-mutation release gate remains open. Open Food Facts search
stays read-only and is not persisted automatically.

The change adds no provider, paid service, recurring request, extra CI job,
production migration or deployment.
