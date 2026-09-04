import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("production headers prohibit embedded scripts and third-party browser connections", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const csp = config.headers[0].headers.find((header) => header.key === "Content-Security-Policy")?.value;
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self'/);
});

test("dashboard keeps dynamic market updates and table headers accessible", async () => {
  const page = await read("public/index.html");
  assert.match(page, /id="modeLabel"/);
  assert.match(page, /class="status-card" aria-live="polite"/);
  assert.match(page, /id="agentConsensus" class="agent-consensus" aria-live="polite"/);
  assert.match(page, /<th scope="col">Company<\/th>/);
  assert.match(page, /aria-label="Risk appetite from 1 to 10"/);
});

test("keyboard focus styling is retained for interactive controls", async () => {
  const css = await read("public/polish.css");
  assert.match(css, /button:focus-visible/);
  assert.match(css, /outline:3px solid #14765a/);
});

test("risk slider uses an explicit 1–10 calibration and visual fill", async () => {
  const script = await read("public/app.js");
  const css = await read("public/portfolio.css");
  assert.match(script, /Math\.max\(1, Math\.min\(10, Number\(value\) \|\| 5\)\)/);
  assert.match(script, /--risk-fill/);
  assert.match(css, /linear-gradient\(to right,var\(--green\) 0 var\(--risk-fill\)/);
});

test("portfolio goal selects a distinct scenario baseline", async () => {
  const script = await read("public/app.js");
  assert.match(script, /function goalScenarios\(goal\)/);
  assert.match(script, /"Capital preservation":\[\{label:"Cautious",rate:\.04\}/);
  assert.match(script, /Income:\[\{label:"Cautious",rate:\.05\}/);
  assert.match(script, /goalScenarios\(portfolio\.goal\)/);
});

test("scenario comparison chart is based on calculated scenario rates", async () => {
  const script = await read("public/app.js");
  assert.match(script, /function renderScenarioBars\(scenarios\)/);
  assert.match(script, /scenario\.rate \/ maximum/);
  assert.match(script, /Scenario rate comparison/);
});

test("live visualisations derive their data from tracked constituents", async () => {
  const script = await read("public/app.js");
  const page = await read("public/index.html");
  assert.match(script, /function renderMarketGraphics\(stocks\)/);
  assert.match(script, /renderMarketGraphics\(stocks\)/);
  assert.match(page, /id="marketHeatmap"/);
  assert.match(page, /id="marketGauge"/);
});

test("top market cards share the tracked live basket rather than static metrics", async () => {
  const script = await read("public/app.js");
  assert.match(script, /function renderTopMarketVisuals\(stocks\)/);
  assert.match(script, /Tracked constituents · today/);
  assert.match(script, /renderTopMarketVisuals\(stocks\)/);
});

