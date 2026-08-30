# Gallery Token localized image contract v1

Imported website images that contain English text require localized derived
variants for the same eleven locales as the website and Identity Bridge.

The historical source image is immutable. A translated variant must preserve
the same composition, historical identity, colors, typography character,
shapes, background, illustration or photograph, decoration and visual
hierarchy. Only the words, locale-specific characters and strictly necessary
text-fit or writing-direction adjustments may differ. Factual details may be
updated only when that content change is separately reviewed.

Use the layered source whenever it exists. If only a raster upload is
available, retain that upload unchanged and work on a copy. Each source and
variant must be recorded in a manifest conforming to
`asset-variants.schema.json`, including the source checksum and the precise
approved differences.

No localized image is published directly. It follows translation review,
historical-design comparison, RTL/text-fit checks, preview, review and an
explicit GO.
