# Deploy the reviewed site

The site is hosted with GitHub Pages. Deploy through a reviewed branch and pull request; do not upload files directly to `main`.

## Release gate

Before opening a pull request:

1. Complete the owner-fact checklist for every claim included in the release.
2. Confirm no legacy Pinterest JPEG is being published or promoted; see `pinterest/PUBLISHING-HOLD.md`.
3. Run:

   ```text
   node scripts/check-seo.mjs
   node --test seo-automation/gsc-processor/tests/*.test.mjs
   node --check scripts/indexnow.mjs
   ```

4. Review the changed pages visually on desktop and mobile.
5. Confirm titles, descriptions, canonical URLs, structured data, internal links, forms, `robots.txt`, and `sitemap.xml` match the exact reviewed version.
6. Confirm no private address, numeric property coordinates, credentials, guest data, or unlicensed media are included.

## GitHub workflow

Create a release branch from the intended base, commit only the reviewed scope, push that branch, and open a pull request. Require a human review before merging to `main`. This repository may already contain local commits or unrelated owner work, so inspect the branch and diff before staging anything.

The SEO quality workflow will rerun the claim and structural checks in GitHub. A passing check is necessary but does not replace owner approval.

## After merge

1. Wait for GitHub Pages to finish.
2. Verify the live homepage and every changed URL, including the canonical URL and mobile layout.
3. Verify `/robots.txt`, `/sitemap.xml`, the Google/Bing/Pinterest verification artifacts, and the public IndexNow key file.
4. Confirm the sitemap in Search Console and Bing Webmaster Tools.
5. Dry-run IndexNow for the deployed URLs. Add `--submit` only after the live pages are confirmed.
6. Record the release URL, timestamp, approved content version, and outcome in the command center.

Do not deploy from the current working tree until the owner-fact gaps and media-rights holds relevant to the release are resolved.
