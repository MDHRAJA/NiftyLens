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
