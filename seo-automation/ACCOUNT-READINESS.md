# Account connection readiness

This is the evidence-based connection state as of July 15, 2026. A verification file or meta tag proves only that the website contains a token; it does not prove that the corresponding account property is active, accessible, or correctly configured.

## Ready locally

| System | Local evidence | Current state |
| --- | --- | --- |
| SEO command center | Native Google Sheet with approval, facts, snapshots, outcomes, and logs | Ready |
| Notification email | `admin@thenorthpineoverlook.com` matched the connected Gmail profile | Verified identity; no messages sent |
| Direct-booking inquiries | `honkytonkiesproperties@gmail.com` owner-confirmed as the current email channel | Approved contact; final prices, policies, payment method, and reservation-confirmation workflow still require written setup |
| Google verification | `google287a6046f4d5e801.html` exists locally and returned HTTP 200 on the live site | Token reachable; Search Console property/access not verified |
| Bing verification | `msvalidate.01` meta tag exists on the homepage | Token present; Webmaster Tools account/status not verified |
| IndexNow | Public key file and dry-run helper exist | Ready for a post-deployment test; nothing submitted |
| Pinterest verification | `pinterest-cc413.html` is a minimal token-only file locally and on production | Deployed in commit `a31fd70` and verified live on July 15, 2026; account property/access is still unverified |
| Analytics | Microsoft Clarity tag is present | Clarity only; no GA4 or distinct inquiry/booking events found |
| Search export processing | Dependency-free GSC CSV processor and tests | Ready for manual exports or a future Make connection |
| Publishing | Static GitHub Pages deployment plus the local SEO quality check | Privacy-only commit `a31fd70` is live; the broader SEO working tree remains local and unpublished |

The live Google verification file, `robots.txt`, and `sitemap.xml` returned HTTP 200 during a read-only check on July 15, 2026. After the privacy-only deployment, the live Pinterest verification URL returned HTTP 200 with the reviewed 327-byte token-only page. The token and `noindex, nofollow` directive were present; the saved email, personal details, profile image, and Pinterest links were absent.

## Still requires an approved account session

1. Confirm or create the Search Console Domain property, verify ownership, submit `sitemap.xml`, and confirm the approved users.
2. Confirm Bing Webmaster Tools ownership, import or submit the site and sitemap, then validate IndexNow only after the reviewed site is deployed.
3. Create or select the approved GA4 property and define separate events for opening-list click, booking-page visit, inquiry, and confirmed booking. Do not treat a `mailto:` click as an inquiry or booking.
4. Create Make connections with least-privilege Google, email, and GitHub access. Keep tokens and secrets outside the repository and spreadsheet.
5. Run the website Search Console import in read-only mode first, write only `New` opportunities, and verify the result before enabling a schedule.
6. Instagram is owner-approved as `https://www.instagram.com/thenorthpineoverlook/`; the previous handle has been retired and removed. Verify any other platform URL separately before publishing its link or adding it to `sameAs` structured data.
7. Document the direct-booking payment and confirmation workflow, then add and verify the Airbnb and Vrbo listing URLs when they become available at launch. Confirm Google Vacation Rentals eligibility before any distribution setup.

## Connection order

Complete the owner-fact gate first, deploy the reviewed claim-safe site second, connect Search Console/Bing/analytics third, and enable Make schedules last. Keep draft generation and publishing approval disabled during the first several test runs.

## Definition of done

- Account owner and recovery access are documented.
- Domain and sitemap status are visible in both Google and Bing.
- Analytics receives test events with no private guest data.
- One manual GSC export reaches **Performance Snapshots** and creates only reviewable `New` opportunities.
- One failure test writes to **Automation Log** and sends the approved notification.
- No scenario can draft without `Approved` or publish without `Publish Approved`.
