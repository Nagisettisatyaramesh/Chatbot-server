(() => {
  const API_BASE = window.location.origin;

  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("formError");
    errorEl.style.display = "none";

    const body = {
      businessName: document.getElementById("businessName").value.trim(),
      websiteUrl: document.getElementById("websiteUrl").value.trim(),
      category: document.getElementById("category").value.trim(),
      humanPhone: document.getElementById("humanPhone").value.trim(),
      email: document.getElementById("email").value.trim(),
      address: document.getElementById("address").value.trim(),
      hours: document.getElementById("hours").value.trim(),
      adminUsername: document.getElementById("adminUsername").value.trim(),
      adminPassword: document.getElementById("adminPassword").value,
    };

    const submitBtn = document.getElementById("submitBtn");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating...";

    try {
      const resp = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Registration failed");

      document.getElementById("formCard").classList.add("hide");
      document.getElementById("resultCard").classList.add("show");
      document.getElementById("websiteIdOut").textContent = data.websiteId;
      document.getElementById("snippetOut").textContent = data.embedSnippet;
      const adminLink = document.getElementById("adminLinkOut");
      adminLink.href = data.adminLoginUrl;
      adminLink.textContent = data.adminLoginUrl;

      document.getElementById("reactSnippet").textContent = [
        "useEffect(() => {",
        '  const script = document.createElement("script");',
        `  script.src = "${data.widgetSrc}";`,
        `  script.setAttribute("data-website-id", "${data.websiteId}");`,
        `  script.setAttribute("data-chat-endpoint", "${data.chatEndpoint}");`,
        "  document.body.appendChild(script);",
        "  return () => document.body.removeChild(script);",
        "}, []);",
      ].join("\n");

      document.getElementById("nextjsSnippet").textContent = [
        `<Script`,
        `  src="${data.widgetSrc}"`,
        `  data-website-id="${data.websiteId}"`,
        `  data-chat-endpoint="${data.chatEndpoint}"`,
        `  strategy="afterInteractive"`,
        `/>`,
      ].join("\n");
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create My Chatbot";
    }
  });

  document.getElementById("installTabs").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    document.querySelectorAll("#installTabs button").forEach((b) => b.classList.toggle("active", b === btn));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === btn.dataset.tab));
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const text = document.getElementById("snippetOut").textContent;
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById("copyBtn");
      btn.textContent = "Copied!";
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    } catch {
      // clipboard unavailable -- user can still select and copy manually
    }
  });
})();
