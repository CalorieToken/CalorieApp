# Third-party software notice

CalorieApp uses third-party packages including FastAPI, Uvicorn, Pydantic,
HTTPX, SQLModel, psycopg, Next.js, React, TypeScript, Tailwind CSS, and their
transitive dependencies. Those components remain governed by their respective
upstream licences. The repository's default rights reservation does not
relicense them.

Before distributing a source archive, container, executable, or static bundle:

1. generate an exact software bill of materials from the resolved build;
2. retain all required copyright, licence, attribution, and NOTICE texts;
3. investigate packages whose lock metadata omits a licence;
4. run vulnerability and licence-policy checks; and
5. repeat the review whenever the lockfiles or deployment image change.

Package names and trademarks identify compatibility only and do not imply
sponsorship. No dependency establishes that the project's product concept is
novel, exclusive, or patent-clear.

The WordPress Identity Bridge is a separately licensed GPL-2.0-or-later
component. Its release-file inventory, known external interfaces and unresolved
source-clearance work are recorded in
`contracts/identity-bridge/v1/code-provenance.json` and
`docs/IDENTITY_BRIDGE_CODE_PROVENANCE.md`. See its `LICENSE` and bundled
`THIRD_PARTY_NOTICES.md` files. Open Food Facts data is addressed separately in
`DATA_LICENSING.md`.

The standalone WordPress Site Style component in `wordpress-plugins/calorietoken-site-style/` also declares GPL-2.0-or-later. Its packaged licence applies to its code. Historical site images/fonts remain references to the existing site and retain their original rights; they are not granted a new licence here. The display-language runtime is shared with CalorieApp.

The optional-on-use food barcode decoder bundles `@zxing/browser` 0.1.5 (MIT),
`@zxing/library` 0.21.3 (Apache-2.0, with its included additional notices), and
`ts-custom-error` as resolved in the lockfile (MIT). Complete upstream texts
are retained at `frontend/public/barcode-licenses.txt`, served with the app.
The libraries decode locally; no CDN service or external image processing is
used. This does not relicense the surrounding CalorieApp or brand.

The ZXing library's npm metadata says MIT, while its shipped LICENSE retains
Apache-2.0 and additional upstream notices. This release preserves that full
file and does not treat the metadata as a blanket relicense. The optional
`@zxing/text-encoding` 0.9.0 dependency's complete LICENSE.md is retained too;
it identifies its public-domain/Apache-2.0 terms and Encoding Standard material.
