# GSC export processor

This credential-free command-line tool turns two consecutive Google Search Console
28-day CSV exports into the exact CSV schemas used by the **North Pine SEO Command
Center**. It uses only Node.js 22 built-ins: no account credentials, API token,
package install, network call, approval action, or publishing action is involved.

## Export the input files

In Search Console, export one report for the latest 28 complete days and another
for the immediately preceding 28 days. Both exports must include the **Query** and
**Page** dimensions plus Clicks, Impressions, CTR, and Position. Common headers such
as `Top queries`, `Top pages`, and `Average Position` are accepted regardless of
capitalization.

## Run

From this directory:

```powershell
node .\gsc-processor.mjs .\current.csv .\previous.csv `
  --current-end 2026-07-12 `
  --profile new-site `
  --output-dir .\output
```

`--current-end` is required because a GSC CSV does not record its report dates.
The other three window dates are derived automatically and validated as consecutive
28-day windows. Use `node .\gsc-processor.mjs --help` for every option.

The command writes:

- `search-opportunities.csv` — qualifying current query/page pairs, always with
  `Status` set to `New`; all AI, review, approval, draft, and publication fields are
  blank.
- `performance-snapshots.csv` — current-window aggregates ready to append to the
  Performance Snapshots sheet. Add `--include-previous-snapshot` only for an initial
  history backfill; normal weekly runs omit the old window to prevent duplicates.

Clicks and impressions are summed for duplicate query/page rows. CTR is recomputed
as clicks divided by impressions, and position is impression-weighted. CTR output is
a numeric ratio (`0.025` means 2.5%) so Google Sheets can format and calculate it.
Stable IDs depend on the source plus normalized query/page (and snapshot window), not
on run time or row order.

## Thresholds

Built-in profiles match the automation manual:

- `new-site`: impressions >= 10, clicks <= 2, position 4–30.
- `established-site`: impressions >= 50, CTR strictly below the weighted site
  average for the current export, position 4–20.

Override individual values with `--min-impressions`, `--max-clicks`,
`--min-position`, `--max-position`, and `--max-ctr`. CTR accepts a ratio, percentage,
`site-average`, or `none`. For repeatable settings, copy `thresholds.example.json`
and pass it with `--config`.

Current-versus-previous deltas are computed before filtering and influence the
rule-derived High/Medium/Low priority. They are not added as extra CSV columns because
the Command Center schemas are fixed. A High priority requires at least twice the
profile's impression floor plus growing/non-declining impressions and stagnant CTR
or clicks; low-volume matches are normally Medium.

## Test

```powershell
npm test
```

Fixtures cover common GSC header variations, duplicate aggregation, both profiles,
stable IDs, exact output headers, snapshot backfill, and the mandatory `New` status.
