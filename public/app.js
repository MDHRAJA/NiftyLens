const byId = (id) => document.getElementById(id);
const riskNames = { 1: "Conservative", 2: "Moderate", 3: "Aggressive" };
let portfolio = JSON.parse(localStorage.getItem("niftylens-portfolio-v2") || "null");
let marketContext = { mode: "demo", evidence: [] };

function renderPortfolio() {
  const hasPortfolio = Boolean(portfolio);
  byId("profileName").textContent = hasPortfolio ? "Portfolio" : "Set up";
  byId("profileLabel").textContent = hasPortfolio ? `${riskNames[portfolio.risk]} · ${portfolio.stock}` : "your portfolio";
  byId("editPortfolio").textContent = hasPortfolio ? "Edit portfolio inputs →" : "Set up my portfolio →";
  if (!hasPortfolio) return;
  const cautious = portfolio.risk === 1 || portfolio.allocation >= 30;
  byId("recommendationTitle").textContent = cautious ? "Your concentration needs a measured response." : "A research view tailored to your portfolio.";
  byId("recommendationCopy").textContent = cautious
    ? `${portfolio.stock} accounts for ${portfolio.allocation}% of your ₹${portfolio.value.toLocaleString("en-IN")} portfolio. Current index momentum is constructive, but concentration and your ${riskNames[portfolio.risk].toLowerCase()} risk setting call for patience.`
    : `${portfolio.stock} is ${portfolio.allocation}% of your ₹${portfolio.value.toLocaleString("en-IN")} portfolio. Its research signal can be reviewed against your ${portfolio.horizon} horizon and ${portfolio.goal.toLowerCase()} goal.`;
  byId("recommendationReasons").innerHTML = [`${portfolio.allocation}% current allocation`, `${portfolio.horizon} horizon`, portfolio.goal].map((item) => `<span>${item}</span>`).join("");
  byId("portfolioVisual").innerHTML = `<div class="portfolio-insight"><div class="donut" style="--allocation:${portfolio.allocation}%"><div><strong>${portfolio.allocation}%</strong><span>${portfolio.stock}</span></div></div><div><span class="pill positive-bg">Your allocation</span><p>₹${Math.round(portfolio.value * portfolio.allocation / 100).toLocaleString("en-IN")} in ${portfolio.stock}<br>₹${Math.round(portfolio.value * (100 - portfolio.allocation) / 100).toLocaleString("en-IN")} across other holdings/cash</p></div></div>`;
  renderPlanReview();
}

function futureValue(rate, years) {
  const monthlyRate = rate / 12;
  const months = years * 12;
  return portfolio.value * (1 + rate) ** years + portfolio.monthly * (((1 + monthlyRate) ** months - 1) / monthlyRate);
}

function renderPlanReview() {
  if (!portfolio) return;
  const years = portfolio.horizon === "1 year" ? 1 : portfolio.horizon === "3 years" ? 3 : 5;
  const invested = portfolio.value + portfolio.monthly * years * 12;
  const scenarios = [{ label:"Cautious", rate:.06 }, { label:"Illustrative", rate:.10 }, { label:"Optimistic", rate:.14 }];
  const highConcentration = portfolio.allocation >= 25;
  const approach = highConcentration ? `A better approach: cap ${portfolio.stock} near 20% and direct new monthly contributions toward a diversified Nifty 50 fund or under-represented sectors.` : `Your allocation is below the 25% concentration watch level. Keep reviewing it as new contributions change the balance.`;
  const evidenceReady = marketContext.mode === "live" && marketContext.evidence?.length;
  byId("planAnalysis").innerHTML = `<div class="plan-review"><span class="eyebrow">Plan review · scenario engine</span><h3>${highConcentration ? "Concentration is the main trade-off." : "Your plan is reasonably diversified at this allocation."}</h3><p>Illustrative value after ${years} year${years > 1 ? "s" : ""}; includes your ₹${portfolio.monthly.toLocaleString("en-IN")} monthly contribution. Returns are scenarios, not forecasts.</p><div class="projection-grid">${scenarios.map((scenario) => { const value = futureValue(scenario.rate, years); return `<div class="projection"><span>${scenario.label}</span><strong>₹${Math.round(value).toLocaleString("en-IN")}</strong><small>${Math.round(scenario.rate * 100)}% annual scenario · gain ₹${Math.max(0, Math.round(value - invested)).toLocaleString("en-IN")}</small></div>`; }).join("")}</div><div class="alternative"><strong>Suggested approach</strong>${approach}</div><button class="ai-button" id="askAiReview" type="button" ${evidenceReady ? "" : "disabled"}>${evidenceReady ? "Ask AI to critique verified evidence" : "AI review waits for verified data"}</button><div id="aiReview" class="ai-review" aria-live="polite">${evidenceReady ? "" : "Demo data is never used to create an AI investment recommendation."}</div></div>`;
  if (evidenceReady) byId("askAiReview").addEventListener("click", requestAiReview);
}

async function requestAiReview() {
  const button = byId("askAiReview"); const target = byId("aiReview");
  button.disabled = true; button.textContent = "Reviewing your plan…"; target.textContent = "";
  try {
    const response = await fetch("/api/plan-review", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ plan: portfolio, marketContext }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || "AI review is unavailable");
    const review = data.review;
    target.innerHTML = `<strong>${review.headline}</strong><p>${review.assessment}</p><p><b>Better approach:</b> ${review.better_approach}</p><p><b>Risks:</b> ${(review.risks || []).join(" · ")}</p><p><b>Questions to consider:</b> ${(review.questions || []).join(" · ")}</p><p><b>Verified evidence:</b> ${(data.evidence || []).map((item) => `<a href="${item.url}" target="_blank" rel="noreferrer">${item.id}</a>`).join(" · ")}</p>`;
  } catch (error) {
    target.innerHTML = `<strong>AI review is not configured yet.</strong><p>${error.message} Add <code>GEMINI_API_KEY</code> to Vercel before deploying. The scenario engine above still works locally.</p>`;
  } finally { button.disabled = false; button.textContent = "Ask AI to critique this plan"; }
}

function openPortfolioDialog() {
  if (portfolio) {
    byId("portfolioValue").value = portfolio.value; byId("monthlyContribution").value = portfolio.monthly; byId("stockSymbol").value = portfolio.stock; byId("stockAllocation").value = portfolio.allocation; byId("horizon").value = portfolio.horizon; byId("goal").value = portfolio.goal; byId("risk").value = portfolio.risk; byId("riskValue").textContent = riskNames[portfolio.risk];
  } else {
    byId("portfolioForm").reset(); byId("riskValue").textContent = "Choose a risk level";
  }
  byId("portfolioDialog").showModal();
}

function renderMovers(stocks) {
  byId("moversChart").innerHTML = stocks.map((stock) => { const height = Math.max(28, Math.abs(stock.move) * 120); return `<div class="mover"><strong>${stock.move > 0 ? "+" : ""}${stock.move.toFixed(2)}%</strong><div class="mover-bar ${stock.move < 0 ? "negative" : ""}" style="height:${height}px"></div><span>${stock.symbol}</span></div>`; }).join("");
}

async function loadDashboard() {
  const response = await fetch("/api/snapshot"); const data = await response.json();
  marketContext = { mode: data.mode === "live" ? "live" : "demo", evidence: data.evidence || [] };
  byId("asOf").textContent = `As of ${data.asOf}`; byId("modeLabel").textContent = data.mode === "demo" ? "Demo data · source-ready" : "Credentials detected · live feed pending";
  byId("indexValue").textContent = data.index.value.toLocaleString("en-IN", { minimumFractionDigits: 2 }); byId("indexChange").textContent = `▲ ${data.index.change}% today · ${data.index.breadth}`; byId("indexStatus").textContent = data.index.status; byId("indexSummary").textContent = "Momentum and volume are supportive, while institutional and volatility context asks for measured confidence.";
  byId("signals").innerHTML = data.signals.map((signal) => `<article class="signal-card"><span class="eyebrow">${signal.label}</span><strong>${signal.value}</strong><p>${signal.detail}</p><div class="meter"><span style="width:${signal.confidence}%"></span></div><div class="confidence">${signal.confidence}% confidence</div></article>`).join("");
  renderMovers(data.constituents);
  byId("constituents").innerHTML = data.constituents.map((stock) => `<tr><td><span class="company">${stock.symbol}</span><small>${stock.name}</small></td><td>${stock.sector}</td><td class="${stock.move < 0 ? "move-down" : "positive"}">${stock.move > 0 ? "▲" : "▼"} ${Math.abs(stock.move).toFixed(2)}%</td><td><span class="pill ${stock.signal === "Watch" ? "warning-bg" : "positive-bg"}">${stock.signal}</span></td><td>${stock.weight}%</td><td><span class="filing">${stock.filing}</span></td></tr>`).join("");
  byId("sources").innerHTML = data.sources.map((source) => `<a href="${source.url}" target="_blank" rel="noreferrer"><strong>${source.name}</strong><span class="source-state">${source.state}</span><small>${source.kind}</small></a>`).join("");
}

byId("showSources").addEventListener("click", () => byId("sourceDialog").showModal()); byId("closeSources").addEventListener("click", () => byId("sourceDialog").close());
["editPortfolio", "profileButton", "portfolioNav"].forEach((id) => byId(id).addEventListener("click", openPortfolioDialog)); byId("closePortfolio").addEventListener("click", () => byId("portfolioDialog").close());
byId("risk").addEventListener("input", (event) => { byId("riskValue").textContent = riskNames[event.target.value]; });
byId("portfolioForm").addEventListener("submit", (event) => { event.preventDefault(); portfolio = { value:Number(byId("portfolioValue").value), monthly:Number(byId("monthlyContribution").value), stock:byId("stockSymbol").value, allocation:Number(byId("stockAllocation").value), horizon:byId("horizon").value, goal:byId("goal").value, risk:Number(byId("risk").value) }; localStorage.setItem("niftylens-portfolio-v2", JSON.stringify(portfolio)); renderPortfolio(); byId("portfolioDialog").close(); byId("portfolio").scrollIntoView({ behavior:"smooth" }); });
document.querySelectorAll("[data-scroll]").forEach((button) => button.addEventListener("click", () => byId(button.dataset.scroll).scrollIntoView({ behavior:"smooth" })));
renderPortfolio(); loadDashboard().catch(() => { byId("asOf").textContent = "Data temporarily unavailable"; });
