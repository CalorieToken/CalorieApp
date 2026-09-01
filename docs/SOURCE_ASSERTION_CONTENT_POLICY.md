# Source assertion content policy

Status: policy `1.0.0` is enforced by the internal assertion-ingest service
before database access. It does not enable a source, public route, migration or
deployment.

## Initial reviewed scope

The initial policy accepts only source-neutral numeric nutrition assertions per
100g. Energy uses `kcal-per-100g` or the separate `nutrition.energy-kj` key with
`kj-per-100g`. Protein, fat, saturated fat, carbohydrates, sugars, fiber, salt
and sodium use `g-per-100g`.

Values must be finite, non-negative decimal strings with at most six fractional
digits. Gram-based values are bounded from 0 through 100. Energy is bounded from
0 through 1,000 kcal or 5,000 kJ per 100g. Equivalent representations such as
`7.500000` and `7.5` become one canonical value before idempotency and duplicate
checks.

## Privacy and payload boundary

Unknown attributes, free text, URLs, email-like values, signs, exponent notation,
unit mismatches and out-of-range numbers fail before database work. This closes
the previously unrestricted text path into the generic assertion value; it does
not replace quarantine or human moderation of otherwise valid-looking numbers.

The policy is an application-service boundary. The generic catalog schema stays
source-neutral, while direct catalog-table writes remain forbidden outside
reviewed migrations and synthetic tests. Production database privileges remain
a separate release proof.

## Human control and non-claims

Adding an attribute, unit, range or non-numeric value type requires a reviewed
policy and contract change. No adapter, automated agent or ecosystem client may
expand the allowlist itself. The policy does not decide whether an assertion is
true, licence-compatible or suitable for public display; quarantine, moderation,
provenance and source-specific licence review remain mandatory.
