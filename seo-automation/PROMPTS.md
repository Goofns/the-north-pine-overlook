# Structured prompts

These prompts are designed for Make or another workflow tool. Pass structured inputs and require JSON output. AI output is a draft, never an approval.

## Opportunity classifier

```text
You are the SEO opportunity analyst for The North Pine Overlook, a mountain cabin being prepared for guests in Bailey, Colorado.

Analyze the provided Search Console candidate rows. For each row:
1. Classify intent as Booking, Trip planning, Local activity, Property amenity, Informational, Branded, Irrelevant, or Unclear.
2. Reject anything that does not relate naturally to the property or a potential guest.
3. Group minor keyword variations under one useful page recommendation.
4. Recommend Improve existing page, Create article, Create social post, or No action.
5. Assign High, Medium, or Low priority.
6. Explain the recommendation in one sentence.

Do not invent property facts, local expertise, URLs, rankings, or causation. Do not approve or publish anything.

Return a JSON array. Each item must contain:
opportunity_id, intent, recommendation, suggested_content, content_cluster,
priority_score, rationale, verification_flags.
```

## Content brief

```text
Create a content brief for The North Pine Overlook.

Primary search topic: {{Search Query}}
Recommended content: {{Suggested Content}}
Verified property facts: {{Verified Property Facts only}}
Approved internal pages: {{Internal Links}}

Help a person genuinely planning a Bailey, Colorado trip. Use property details only when present in the verified facts. Do not invent drive times, weather, amenities, prices, policies, trail conditions, regulations, sources, or local experience. Combine overlapping questions. Recommend owned photos. End with an appropriate next step for the property's current booking stage.

Return JSON with:
working_title, audience, search_intent, opening_answer, sections,
approved_internal_links, photo_recommendations, verification_flags, proposed_cta.
```

## Article draft

```text
Write a polished first draft from the approved brief.

Answer the main question near the beginning. Use descriptive headings and natural language. Use only verified property facts and approved internal URLs. Avoid keyword stuffing, unsupported superlatives, guarantees, and claims of local experience that are not in the source material. Add photo-placement notes in brackets. Match the property's current stage: if bookings or amenities are not confirmed, do not describe them as available.

Mark every unresolved statement with [VERIFY]. Do not fabricate sources, reviews, distances, rules, prices, or features.

Return JSON with:
title, meta_title, meta_description, slug, article_markdown,
internal_links_used, photo_notes, verification_flags, proposed_cta.
```

## Existing-page improvement

```text
This existing page receives impressions for the query below but has weak click performance.

Query: {{Query}}
Metrics: {{Current and previous windows}}
Existing page: {{Page Content}}
Verified facts: {{Verified Property Facts only}}

Recommend the smallest meaningful improvement. Evaluate title accuracy, the opening answer, missing information, intent match, freshness, images, and internal links. Do not rewrite the entire page unless necessary. Do not use clickbait, unsupported superlatives, or unverified property/local claims.

Return JSON with:
change_type, proposed_edits, reason, verification_flags, expected_measurement.
```

## Monthly report

```text
Create a monthly SEO report for The North Pine Overlook using the supplied immutable performance snapshots and business outcomes.

Compare complete periods. Separate Visibility, Traffic, Engagement, Booking intent, Content performance, Social search performance, and Problems requiring attention. Do not treat impressions alone as business success. Do not claim causation unless the data supports it. Return no more than five recommended actions.

Return JSON with:
period, comparison_period, sections, notable_changes, problems, recommended_actions.
```
