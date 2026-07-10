# Deploy the full-site rebrand — Goofns/the-north-pine-overlook

This package contains every changed file, already at the right paths.
Your `assets/brand/` folder is already in the repo from the last upload — nothing new needed there.

## What changed
- index.html            — full rebrand (navy/cream/clay palette, real logos replace the gold
                          placeholder SVG marks, canonical + OG/Twitter meta added, JSON-LD
                          logo/sameAs, Instagram footer link, Poppins body font)
- things-to-do.html     — full rebrand (same treatment as fishing)
- hiking.html           — full rebrand
- rates.html            — full rebrand
- directions.html       — full rebrand
- what-to-bring.html    — full rebrand
- fishing.html          — two tiny touch-ups (scrolled-nav tint + glow tone) so all pages
                          share one exact color system
- indextree.html        — link-in-bio page rebranded: brand cream background, icon avatar,
                          handle corrected to @northpineoverlook, brand fonts, OG image
- favicon.ico           — regenerated with the brand icon (replaces old mark)
- favicon-192.png       — regenerated with the brand icon

## Option A — GitHub website (2 minutes, no tools)
1. Open https://github.com/Goofns/the-north-pine-overlook
2. Click "Add file" → "Upload files"
3. Drag ALL files from this zip into the upload area
   (GitHub will show them as replacing the existing ones — that's correct)
4. Commit message: "Full-site rebrand — official palette, logos, favicons"
5. Click "Commit changes" to main
6. GitHub Pages redeploys automatically — give it 1–2 minutes, then hard-refresh
   the site (Ctrl/Cmd+Shift+R) since browsers cache CSS and favicons aggressively.

## Option B — git command line
    git clone https://github.com/Goofns/the-north-pine-overlook.git
    cd the-north-pine-overlook
    # unzip this package over the repo folder, replacing files, then:
    git add -A
    git commit -m "Full-site rebrand — official palette, logos, favicons"
    git push

## Two things to verify yourself
1. SOCIAL HANDLES on indextree.html — your brand guide specifies @northpineoverlook,
   so I updated Instagram everywhere. But the TikTok / YouTube / Facebook / Pinterest
   URLs still say "TheNorthPineOverlook" from the template. Open indextree.html, find
   the LINKS and SOCIALS lists near the bottom, and correct any URL to the accounts
   you actually registered (delete entries for platforms you're not on).
2. HOUSEKEEPING (optional) — the social-media kit files from last time
   (covers/, profile-pictures/, README-social-kit.txt, REBRAND-NOTES.txt) are sitting
   in the repo root, which means they're publicly downloadable on your website.
   Harmless, but you can delete them from the repo and keep them on your computer.

## After photography day
Swap the homepage link-preview image: replace assets/brand/og-image.jpg with the
twilight exterior shot (same filename, 1200x630) — a real photo will out-click the
logo card on shared links.
