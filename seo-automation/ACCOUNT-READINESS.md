# Account connection readiness

This is the evidence-based connection state as of July 15, 2026, with the
Google, Bing and IndexNow rows re-verified on September 9, 2026 inside
signed-in Search Console and Bing Webmaster Tools sessions. A verification file or meta tag proves only that the
website contains a token; it does not prove that the corresponding account
property is active, accessible, or correctly configured. Rows below that have
not been rechecked still carry their July 15 state.

## Ready locally

| System | Local evidence | Current state |
| --- | --- | --- |
| SEO command center | Native Google Sheet with approval, facts, snapshots, outcomes, and logs | Ready |
| Notification email | `admin@thenorthpineoverlook.com` matched the connected Gmail profile | Verified identity; no messages sent |
| Direct-booking inquiries | `honkytonkiesproperties@gmail.com` owner-confirmed as the current email channel | Approved contact; final prices, policies, payment method, and reservation-confirmation workflow still require written setup |
| Google verification | `google287a6046f4d5e801.html` exists locally and returned HTTP 200 on the live site | **Verified and active.** Property `https://thenorthpineoverlook.com/` exists and is accessible; `sitemap.xml` submitted July 11, 2026, last read September 2, 2026, Success, 10 pages discovered. Approved-user list not yet reviewed. Rechecked September 9, 2026 |
| Bing verification | `msvalidate.01` meta tag exists on the homepage | **Verified and active.** Ownership confirmed in Webmaster Tools; `sitemap.xml` submitted June 30, 2026 and last crawled September 7, 2026 with Success, 10 URLs discovered, 0 errors, 0 warnings. Search Performance reports 257 impressions and 8 clicks. Rechecked September 9, 2026 |
| IndexNow | Public key file and dry-run helper exist | **Live.** Key file reachable and its contents match the filename. 11 URLs submitted September 9, 2026 and confirmed in the Webmaster Tools IndexNow report, source `Self` |
| Pinterest verification | `pinterest-cc413.html` is a minimal token-only file locally and on production | Deployed in commit `a31fd70` and verified live on July 15, 2026; account property/access is still unverified |
| Analytics | Microsoft Clarity tag is present | Clarity only; no GA4 or distinct inquiry/booking events found |
| Search export processing | Dependency-free GSC CSV processor and tests | Ready for manual exports or a future Make connection |
| Publishing | Static GitHub Pages deployment plus the local SEO quality check | Privacy-only commit `a31fd70` is live; the broader SEO working tree remains local and unpublished |

The live Google verification file, `robots.txt`, and `sitemap.xml` returned HTTP 200 during a read-only check on July 15, 2026. After the privacy-only deployment, the live Pinterest verification URL returned HTTP 200 with the reviewed 327-byte token-only page. The token and `noindex, nofollow` directive were present; the saved email, personal details, profile image, and Pinterest links were absent.

## Still requires an approved account session

1. **Search Console property and sitemap are confirmed done** (September 9, 2026). What remains of this item is narrower: review the approved-user list under Settings, and clear the three invalid sitemap submissions described below.
2. Create or select the approved GA4 property and define separate events for opening-list click, booking-page visit, inquiry, and confirmed booking. Do not treat a `mailto:` click as an inquiry or booking.
3. Create Make connections with least-privilege Google, email, and GitHub access. Keep tokens and secrets outside the repository and spreadsheet.
4. Run the website Search Console import in read-only mode first, write only `New` opportunities, and verify the result before enabling a schedule.
5. Instagram is owner-approved as `https://www.instagram.com/thenorthpineoverlook/`; the previous handle has been retired and removed. Verify any other platform URL separately before publishing its link or adding it to `sameAs` structured data.
6. Document the direct-booking payment and confirmation workflow, then add and verify the Airbnb and Vrbo listing URLs when they become available at launch. Confirm Google Vacation Rentals eligibility before any distribution setup.

## Completed in an approved account session

**September 9, 2026 — Google Search Console.** Signed-in review. The website
property `https://thenorthpineoverlook.com/` exists and is accessible, and
`sitemap.xml` was submitted on July 11, 2026, last read September 2, 2026, with
status Success and 10 pages discovered. Three separate properties also exist for
the Instagram, X and YouTube creator profiles.

**Defect found, not yet fixed.** Three ordinary HTML pages have been submitted
as if they were sitemaps and each reports a permanent error:

| Entry | Submitted | Status |
| --- | --- | --- |
| `/things-to-do.html` | July 3, 2026 | 1 error |
| `/hiking.html` | July 3, 2026 | 1 error |
| `/staunton-state-park.html` | July 11, 2026 | 1 error |

They discover zero pages and will error indefinitely. They should be removed
from the Sitemaps report; the valid `/sitemap.xml` entry is unaffected. Removing
them changes account state, so it is left for an owner decision.

**September 9, 2026 — Bing Webmaster Tools.** Signed-in review of
`thenorthpineoverlook.com`. Ownership already verified; no site changes were
needed. Sitemap already submitted and crawling cleanly. IndexNow submission of
all 11 pages sent and confirmed. This closes the former item 2 of the list
above.

Corrections recorded at the same time: the site **is** indexed in Bing, Bing
ownership had been verified since approximately June 30, 2026, and the Google
Search Console property and sitemap were already in place. All three had been
reported as outstanding on the strength of this file rather than a live check.
Treat undated rows here as assumptions until they are rechecked against the
account.

The backlink profile was reviewed in the same session: **1 referring domain**
(`x.com`, the property's own X profile) against 56 for a comparable Bailey
lodging business. Findings and the outreach plan are in
`Documents/TNPO/seo/BACKLINK-PACK.md`, outside this repository.

## Connection order

Complete the owner-fact gate first, deploy the reviewed claim-safe site second, connect Search Console/Bing/analytics third, and enable Make schedules last. Keep draft generation and publishing approval disabled during the first several test runs.

## Definition of done

- Account owner and recovery access are documented.
- Domain and sitemap status are visible in both Google and Bing.
- Analytics receives test events with no private guest data.
- One manual GSC export reaches **Performance Snapshots** and creates only reviewable `New` opportunities.
- One failure test writes to **Automation Log** and sends the approved notification.
- No scenario can draft without `Approved` or publish without `Publish Approved`.
