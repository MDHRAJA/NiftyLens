import assert from "node:assert/strict";
import test from "node:test";
import { buildResearch, ruleSynthesis } from "../api/stock-consensus.mjs";

test("three independent agents are created for every stock", () => {
  const snapshot = { asOf:"01 Sep 2026", constituents:[{ symbol:"RELIANCE", move:1.2, report:{ value:20000000000, date:"2026-06-30" } }] };
  const research = buildResearch(snapshot);
  assert.equal(research.length, 1);
  assert.equal(research[0].agents.length, 3);
  assert.deepEqual(research[0].agents.map((agent) => agent.agent), ["Momentum agent", "Earnings agent", "Risk agent"]);
});

test("Sentinel Agent fallback uses a downside veto instead of averaging", () => {
  const snapshot = { asOf:"01 Sep 2026", constituents:[{ symbol:"INFY", move:-1.5, report:{ value:10000000000, date:"2026-06-30" } }] };
  const research = buildResearch(snapshot);
  const final = ruleSynthesis(research)[0];
  assert.equal(final.stance, "Cautious");
  assert.match(final.thesis, /does not average/);
});

