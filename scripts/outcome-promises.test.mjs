import assert from "node:assert/strict";
import test from "node:test";

import { findProhibitedOutcomePromises } from "./outcome-promises.mjs";

test("blocks common wildlife, fishing, weather, road, and ranking promises", () => {
  const examples = [
    "Wildlife sightings are guaranteed.",
    "We guarantee you'll catch fish.",
    "Sunshine is guaranteed.",
    "Parking is always available.",
    "Guaranteed first-page rankings.",
  ];

  for (const example of examples) {
    assert.ok(findProhibitedOutcomePromises(example).length > 0, example);
  }
});

test("allows clear disclaimers and negated guarantees", () => {
  const examples = [
    "No wildlife sightings are guaranteed.",
    "We cannot guarantee you'll catch fish.",
    "A manager's schedule does not guarantee fish.",
    "There are no guaranteed wildlife sightings.",
    "Parking is not guaranteed.",
    "First-page rankings are never guaranteed.",
  ];

  for (const example of examples) {
    assert.deepEqual(findProhibitedOutcomePromises(example), [], example);
  }
});
