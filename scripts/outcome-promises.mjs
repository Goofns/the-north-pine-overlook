export const prohibitedOutcomePromises = [
  {
    label: "wildlife sighting promise",
    pattern: /\b(?:guarantee(?:d|s)?|promise[sd]?|sure to)\s+(?:of\s+)?(?:you(?:'ll|\s+will)\s+see\s+)?(?:wildlife|animals?|elk|moose|bears?|bighorn)(?:\s+(?:sightings?|viewing))?\b|\b(?:wildlife|animal|elk|moose|bear|bighorn)(?:\s+(?:sightings?|viewing))?\s+(?:is|are)\s+guaranteed\b|\byou\s+(?:will|are sure to)\s+see\s+(?:wildlife|animals?|elk|moose|bears?|bighorn)\b/gi,
  },
  {
    label: "fishing success promise",
    pattern: /\b(?:guarantee(?:d|s)?|promise[sd]?|sure to)\s+(?:of\s+)?(?:you(?:'ll|\s+will)\s+catch\s+)?(?:a\s+)?(?:catch(?:es)?|fish|trout)\b|\b(?:a\s+)?(?:catch(?:es)?|fish|trout|fishing success)\s+(?:is|are)\s+guaranteed\b|\byou\s+(?:will|are sure to)\s+catch\s+(?:a\s+)?(?:fish|trout)\b/gi,
  },
  {
    label: "weather promise",
    pattern: /\b(?:guarantee(?:d|s)?|promise[sd]?)\s+(?:sun|sunshine|snow|weather|clear skies|perfect conditions)\b|\b(?:sun|sunshine|snow|weather|clear skies|perfect conditions)\s+(?:is|are)\s+guaranteed\b|\bweather\s+(?:is|will be)\s+always\s+(?:clear|perfect|sunny|snowy)\b/gi,
  },
  {
    label: "road, access, or parking promise",
    pattern: /\b(?:roads?|route|access|driveway|parking)\s+(?:is|are|will be)\s+always\s+(?:open|clear|plowed|passable|available|safe)\b|\b(?:guarantee(?:d|s)?|promise[sd]?)\s+(?:road|route|access|driveway|parking)(?:\s+(?:availability|conditions?))?\b|\b(?:road|route|access|driveway|parking)(?:\s+(?:availability|conditions?))?\s+(?:is|are)\s+guaranteed\b/gi,
  },
  {
    label: "search-ranking promise",
    pattern: /\b(?:guarantee(?:d|s)?|promise[sd]?)\s+(?:first[- ]page|page[- ]one|top[- ]?\d+|number one|#1)(?:\s+(?:rank(?:ing)?s?|positions?))?\b|\b(?:first[- ]page|page[- ]one|top[- ]?\d+|number one|#1)\s+(?:rank(?:ing)?s?|positions?)\s+(?:is|are)\s+guaranteed\b|\bwill\s+rank\s+(?:first|#1|number one|at the top)\b/gi,
  },
];

function hasNegatingQualifier(text, index) {
  const prefix = text.slice(Math.max(0, index - 64), index);
  return /\b(?:does\s+not|do\s+not|is\s+not|are\s+not|was\s+not|were\s+not|cannot|can't|won't|never|no|not)(?:\s+(?:a|an|any))?\s*$/i.test(prefix);
}

export function findProhibitedOutcomePromises(text) {
  const findings = [];

  for (const { label, pattern } of prohibitedOutcomePromises) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      if (hasNegatingQualifier(text, index)) continue;
      findings.push({ label, text: match[0], index });
    }
  }

  return findings;
}
