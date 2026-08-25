# Open Food Facts API usage registration draft

Status: prepared for owner review; not yet submitted.

## Proposed factual answers

- Application: CalorieApp
- Version/User-Agent: `CalorieApp/0.1 (info@calorietoken.net)`
- Website: <https://calorietoken.net/>
- Public repository: <https://github.com/CalorieToken/CalorieApp>
- Temporary showcase: <https://calorieapp-frontend.onrender.com/>
- Contact: `info@calorietoken.net`
- Current access: read-only food-product search through the CalorieApp backend
- Current endpoint: legacy full-text search at `/cgi/search.pl`
- Writes/contributions to Open Food Facts: none
- Bulk download or local mirror: none
- Search interaction: explicit user-submitted search, not search-as-you-type
- Stored information: a signed-in user may save a normalized selection in a
  private CalorieApp food log
- Attribution: visible Open Food Facts attribution and ODbL link in the UI
- Expected traffic: temporary showcase/early development; low volume and
  subject to published search rate limits

## Owner checks before submission

1. Confirm that the website, showcase URL, contact address, access pattern,
   storage description, and expected traffic remain accurate.
2. Confirm whether Open Food Facts wants the temporary Render hostname or only
   the stable project website.
3. Retain the submitted answers and confirmation email in controlled evidence
   storage; record a non-sensitive reference and date in `DATA_LICENSING.md`.
4. Re-register or notify Open Food Facts if CalorieApp adds writes, bulk data,
   caching/mirroring, barcode scanning, materially higher traffic, or a new API
   architecture.

Official documentation asks API users to identify the application with a
custom User-Agent, respect rate limits, and submit the API usage form. Form
submission makes external factual representations and therefore requires owner
review.
