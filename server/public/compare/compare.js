(() => {
  const API_BASE = window.location.origin;

  // Deliberately NOT the exact phrasings we already patched today -- these
  // are fresh paraphrases designed to test generalization, since both
  // engines now handle the already-patched cases equally well.
  const PRESETS = [
    "Any vacancies right now?",
    "What's the price for a room?",
    "Are dogs allowed?",
    "I'd like to end my reservation",
    "Can I work out at the gym?",
    "Is there internet access?",
    "What amenities do you offer?",
    "good morning",
  ];

  const presetsEl = document.getElementById("presets");
  for (const p of PRESETS) {
    const btn = document.createElement("button");
    btn.textContent = p;
    btn.addEventListener("click", () => {
      document.getElementById("questionInput").value = p;
      run();
    });
    presetsEl.appendChild(btn);
  }

  function sourcesBadges(sources) {
    if (!sources) return "";
    const mk = (label, val) => `<span class="badge ${val ? "yes" : "no"}">${label}: ${val ? "yes" : "no"}</span>`;
    return [mk("Website", sources.website), mk("Knowledge Base", sources.knowledgeBase), mk("Database", sources.database)].join(" ");
  }

  async function callEndpoint(path, websiteId, message) {
    const start = performance.now();
    try {
      const resp = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, message }),
      });
      const data = await resp.json();
      const ms = Math.round(performance.now() - start);
      return { ...data, ms, ok: resp.ok };
    } catch (err) {
      return { answer: "Request failed: " + err.message, ok: false, ms: Math.round(performance.now() - start) };
    }
  }

  function renderResult(prefix, result) {
    document.getElementById(`${prefix}Answer`).textContent = result.answer;
    const meta = document.getElementById(`${prefix}Meta`);
    const fallbackFlag = result.humanFallback ? '<span class="fallback-flag">Human fallback</span>' : "";
    meta.innerHTML = `${sourcesBadges(result.debug?.sources)} <span>${result.ms}ms</span> ${fallbackFlag}`;
  }

  function addToHistory(question, keywordResult, semanticResult) {
    const history = document.getElementById("history");
    if (history.children.length === 0) {
      const h = document.createElement("h3");
      h.textContent = "History";
      history.appendChild(h);
    }
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="q">${question}</div>
      <div class="row">
        <div><div class="label">Keyword</div>${keywordResult.answer}</div>
        <div><div class="label">Semantic</div>${semanticResult.answer}</div>
      </div>
    `;
    history.insertBefore(item, history.children[1] || null);
  }

  async function run() {
    const websiteId = document.getElementById("websiteId").value;
    const message = document.getElementById("questionInput").value.trim();
    if (!message) return;

    const sendBtn = document.getElementById("sendBtn");
    sendBtn.disabled = true;
    document.getElementById("keywordAnswer").textContent = "Loading...";
    document.getElementById("semanticAnswer").textContent = "Loading...";

    try {
      const [keywordResult, semanticResult] = await Promise.all([
        callEndpoint("/api/chat", websiteId, message),
        callEndpoint("/api/chat-semantic", websiteId, message),
      ]);
      renderResult("keyword", keywordResult);
      renderResult("semantic", semanticResult);
      addToHistory(message, keywordResult, semanticResult);
    } finally {
      sendBtn.disabled = false;
    }
  }

  document.getElementById("sendBtn").addEventListener("click", run);
  document.getElementById("questionInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });
})();
