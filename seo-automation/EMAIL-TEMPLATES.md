# Automation email templates

The connected notification account is `admin@thenorthpineoverlook.com`. Configure the recipient inside the approved Make connection rather than storing credentials in this repository.

## Weekly opportunity summary

Send only when at least one meaningful High-priority opportunity is new or materially changed.

**Subject:** North Pine SEO — {{High Priority Count}} opportunities to review

```text
The weekly Search Console review found {{High Priority Count}} high-priority opportunities for {{Current Window Start}} through {{Current Window End}}.

{{Opportunity Summary}}

Review and approve or reject each row in the North Pine SEO Command Center:
{{Command Center URL}}

Nothing has been drafted or published automatically.
```

## Draft ready for review

**Subject:** North Pine SEO draft ready — {{Primary Topic}}

```text
A draft is ready for factual and editorial review.

Topic: {{Primary Topic}}
Opportunity ID: {{Opportunity ID}}
Draft: {{Draft URL}}
Facts needing attention: {{Verification Flags}}

After review, set the row to Publish Approved only if the exact draft version is ready to publish.
```

## Monthly report

**Subject:** North Pine SEO report — {{Report Month}}

```text
The monthly SEO report is ready:
{{Report URL}}

Headline results:
{{Visibility Summary}}
{{Traffic Summary}}
{{Booking Intent Summary}}

Recommended actions:
{{Recommended Actions}}

The report separates visibility from business outcomes and does not treat impressions alone as success.
```

## Automation failure

**Subject:** Action needed — North Pine SEO automation failed

```text
Scenario: {{Scenario}}
Run ID: {{Run ID}}
Time: {{Timestamp America/Denver}}
Records read: {{Records Read}}
Records written: {{Records Written}}
Error: {{Sanitized Error Summary}}

No unreviewed content was published. Review the Automation Log before retrying:
{{Command Center URL}}
```

Do not include credentials, OAuth tokens, private guest data, or full raw API responses in any notification.
