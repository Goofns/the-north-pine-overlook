# North Pine SEO automation handoff

This folder contains the credential-free part of the SEO system. The public site is static GitHub Pages, so publishing must use a reviewed branch or pull request rather than a direct CMS publish action.

The live account connections are intentionally not configured here. OAuth tokens, API keys, email credentials, and booking data must stay in Make, Google, GitHub secrets, or another approved secret store.

## Command center

The native Google Sheet has seven tabs:

1. **Search Opportunities** — one current record per stable query-and-URL opportunity.
2. **Content Library** — briefs, drafts, versions, approval details, and published content.
3. **Property Facts** — the only property details AI may treat as verified.
4. **Internal Links** — approved live pages and preferred natural anchor text.
5. **Performance Snapshots** — immutable reporting-window rows used for trends and new/lost-query analysis.
6. **Business Outcomes** — inquiries, bookings, and referral sessions entered from analytics or booking systems.
7. **Automation Log** — run IDs, counts, failures, retries, and operator notes.

The sheet uses `America/Denver`. Automations should use the same timezone.

Use `EMAIL-TEMPLATES.md` for the weekly, review-ready, monthly, and failure notifications.

Use `LOCAL-SOURCE-REGISTER.md` when a draft mentions trails, fishing, scenic routes, parks, museums, or local businesses. Its links and audit decisions support review, but every time-sensitive claim still requires a same-day source check before publishing.

Use `TRAVEL-LOCAL-VERIFICATION.md` for the dated travel/fishing audit, owner recommendation shortlist, private-origin drive-time protocol, and property-specific road-approval boundary.

## Required status flow

`New -> Approved -> Drafting -> Review -> Publish Approved -> Published`

`Rejected` is a terminal alternative. Any material edit after approval must return the item to `Review`. No scenario may skip `Publish Approved`.

## Weekly website-opportunity scenario

Run Monday at 9:00 a.m. Mountain Time.

1. Pull the previous 28 complete days from the website Search Console property, grouped by query and page.
2. Pull the 28 complete days immediately before that.
3. Append the new window to **Performance Snapshots**. Do not append the older window again during normal weekly runs.
4. Run the local export processor or equivalent Make filters.
5. For a new site, keep rows with at least 10 impressions, no more than 2 clicks, and position from 4 through 30.
6. Send only those candidates to the opportunity-classification prompt.
7. Upsert **Search Opportunities** by `Opportunity ID`; update metrics and `Last Seen` instead of creating a duplicate.
8. Send one summary only when meaningful high-priority rows were added or materially changed.
9. Write a success, partial, failed, or skipped record to **Automation Log**.

For an established site, use at least 50 impressions, below-site-average CTR, and position from 4 through 20. Thresholds are screening rules, not automatic approval.

## Social-search scenario

Google documents Instagram, TikTok, X, and YouTube platform properties in the Search Console interface. As of July 15, 2026, the public Search Console API documentation does not specifically document their identifiers or behavior. Make support must be treated as unconfirmed until tested in the connected account.

Use this order:

1. Test whether the platform property is selectable and returns query/post rows in Make.
2. If it is not, export the platform performance report from Search Console to Sheets.
3. Feed that export into the same snapshot and opportunity flow with the correct `Source` value.
4. Never silently substitute website data for a missing social property.

## Draft scenario

Trigger only when `Status` changes to `Approved`.

1. Re-read the opportunity row.
2. Read only `Verified` rows from **Property Facts**.
3. Select three to five real rows from **Internal Links**.
4. Create a content brief and list every claim that still needs verification.
5. Create a Google Doc draft and store its URL in `Draft Link`.
6. Set the status to `Review` and log the run.

If structured AI output is invalid, if facts are missing, or if the draft contains `[VERIFY]`, stop in `Review` and notify the operator. Do not publish.

## Static-site publish scenario

Trigger only when `Status` changes to `Publish Approved`.

1. Confirm the approved content version has not changed since approval.
2. Create or update HTML on a non-public Git branch.
3. Update title, meta description, canonical, structured data, internal links, image alt text, and `sitemap.xml`.
4. Run `node scripts/check-seo.mjs`.
5. Require a human-reviewed merge to `main`.
6. After the deployed URL responds successfully, write it to `Published URL`, set `Published`, and update **Internal Links**.
7. Dry-run `node scripts/indexnow.mjs /changed-page.html`, then add `--submit` only after deployment is confirmed. Do not use Google's Indexing API for ordinary articles.

## Monthly report scenario

Run on the first day of each month in `America/Denver`.

Compare complete periods using **Performance Snapshots** and **Business Outcomes**. Report visibility, traffic, engagement, booking intent, content, social search, and problems. Limit recommendations to five and never treat impressions alone as business success.

## Vacation-rental distribution

Do not create a Google Business Profile for the cabin. Individually owned vacation rentals are not eligible to participate directly in Google Vacation Rentals. The practical route is an existing listing on an integrated booking site, or an eligible registered property-management business using an approved connectivity provider. A channel manager alone does not guarantee eligibility or a direct-booking link.

## Before enabling live connections

- Complete `OWNER-FACT-CHECK.md` and update **Property Facts**.
- Confirm the Search Console Domain property, sitemap submission, and user permissions.
- Confirm Bing import and sitemap status.
- Decide whether GPTBot should remain allowed separately from OAI-SearchBot.
- Choose analytics and measurable inquiry/booking events; the current `mailto:` form records only a click.
- Confirm the real booking URL and Google Vacation Rentals eligibility route.
- Store all credentials outside the repository and Sheet.
- Pilot drafts and social outputs for several weeks with final approval enabled.

## Local verification

From the repository root:

```text
node scripts/check-seo.mjs
node --test seo-automation/gsc-processor/tests/*.test.mjs
```

See `gsc-processor/README.md` for the manual Search Console export fallback.

## Primary references checked July 15, 2026

- Search Console platform properties launch: https://developers.google.com/search/blog/2026/07/search-console-social-video-platforms
- Search Console platform-property help: https://support.google.com/webmasters/answer/17148418
- Search Analytics API reference: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- Google Business Profile eligibility: https://support.google.com/business/answer/13763036?hl=en
- Vacation-rental property-manager eligibility: https://support.google.com/hotelprices/answer/12564561?hl=en
- Google Vacation Rentals connectivity partners: https://support.google.com/hotelprices/answer/11946834?hl=en
- Google Indexing API scope: https://developers.google.com/search/apis/indexing-api/v3/using-api
- OpenAI crawler controls: https://developers.openai.com/api/docs/bots
- ChatGPT Search referral parameters: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
