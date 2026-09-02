(() => {
  const API_BASE = window.location.origin;

  let sessionToken = sessionStorage.getItem("admin_session_token");
  let websiteId = sessionStorage.getItem("admin_website_id");
  let editingId = null;

  const loginView = document.getElementById("loginView");
  const appView = document.getElementById("appView");
  const loginError = document.getElementById("loginError");
  const formError = document.getElementById("formError");

  function showApp() {
    loginView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.getElementById("pageTitle").textContent = `Knowledge Admin -- ${websiteId}`;
    loadItems();
    loadDocuments();
  }

  function showLogin() {
    appView.classList.add("hidden");
    loginView.classList.remove("hidden");
  }

  async function api(path, options = {}) {
    const resp = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { "X-Admin-Session": sessionToken } : {}),
        ...(options.headers || {}),
      },
    });
    if (resp.status === 401) {
      sessionToken = null;
      websiteId = null;
      sessionStorage.removeItem("admin_session_token");
      sessionStorage.removeItem("admin_website_id");
      showLogin();
      throw new Error("Session expired, please log in again");
    }
    if (resp.status === 204) return null;
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  document.getElementById("loginBtn").addEventListener("click", async () => {
    loginError.classList.add("hidden");
    const site = document.getElementById("loginWebsiteId").value;
    const username = document.getElementById("loginUsername").value;
    const password = document.getElementById("loginPassword").value;
    try {
      const resp = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: site, username, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Login failed");
      sessionToken = data.sessionToken;
      websiteId = site;
      sessionStorage.setItem("admin_session_token", sessionToken);
      sessionStorage.setItem("admin_website_id", websiteId);
      showApp();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.classList.remove("hidden");
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionToken = null;
    websiteId = null;
    sessionStorage.removeItem("admin_session_token");
    sessionStorage.removeItem("admin_website_id");
    showLogin();
  });

  function resetForm() {
    editingId = null;
    document.getElementById("itemTitle").value = "";
    document.getElementById("itemContent").value = "";
    document.getElementById("formTitle").textContent = "Add Knowledge Article";
    document.getElementById("saveBtn").textContent = "Add Article";
    document.getElementById("cancelEditBtn").classList.add("hidden");
    formError.classList.add("hidden");
  }

  document.getElementById("cancelEditBtn").addEventListener("click", resetForm);

  document.getElementById("saveBtn").addEventListener("click", async () => {
    formError.classList.add("hidden");
    const title = document.getElementById("itemTitle").value.trim();
    const content = document.getElementById("itemContent").value.trim();
    if (!title || !content) {
      formError.textContent = "Both title and content are required.";
      formError.classList.remove("hidden");
      return;
    }
    try {
      if (editingId) {
        await api(`/api/admin/${websiteId}/knowledge/${editingId}`, { method: "PUT", body: JSON.stringify({ title, content }) });
      } else {
        await api(`/api/admin/${websiteId}/knowledge`, { method: "POST", body: JSON.stringify({ title, content }) });
      }
      resetForm();
      loadItems();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.remove("hidden");
    }
  });

  function startEdit(item) {
    editingId = item.id;
    document.getElementById("itemTitle").value = item.title;
    document.getElementById("itemContent").value = item.content;
    document.getElementById("formTitle").textContent = "Edit Knowledge Article";
    document.getElementById("saveBtn").textContent = "Save Changes";
    document.getElementById("cancelEditBtn").classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeItem(id) {
    if (!confirm("Delete this article?")) return;
    try {
      await api(`/api/admin/${websiteId}/knowledge/${id}`, { method: "DELETE" });
      loadItems();
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadItems() {
    const list = document.getElementById("itemList");
    const empty = document.getElementById("emptyState");
    try {
      const items = await api(`/api/admin/${websiteId}/knowledge`);
      document.getElementById("itemCount").textContent = items.length;
      list.innerHTML = "";
      empty.classList.toggle("hidden", items.length > 0);
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div>
            <div class="item-title"></div>
            <div class="item-content"></div>
          </div>
          <div class="item-actions">
            <button class="secondary edit-btn">Edit</button>
            <button class="danger delete-btn">Delete</button>
          </div>
        `;
        row.querySelector(".item-title").textContent = item.title;
        row.querySelector(".item-content").textContent = item.content;
        row.querySelector(".edit-btn").addEventListener("click", () => startEdit(item));
        row.querySelector(".delete-btn").addEventListener("click", () => removeItem(item.id));
        list.appendChild(row);
      }
    } catch (err) {
      list.innerHTML = `<p class="error">${err.message}</p>`;
    }
  }

  // -- Documents --------------------------------------------------------

  const uploadError = document.getElementById("uploadError");
  const uploadStatus = document.getElementById("uploadStatus");
  const fileInput = document.getElementById("fileInput");

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    uploadError.classList.add("hidden");
    uploadStatus.classList.remove("hidden", "success");
    uploadStatus.classList.add("muted");
    uploadStatus.textContent = "Uploading and reading the document...";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${API_BASE}/api/admin/${websiteId}/documents`, {
        method: "POST",
        headers: { "X-Admin-Session": sessionToken },
        body: formData,
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 401) {
        showLogin();
        throw new Error("Session expired, please log in again");
      }
      if (!resp.ok) throw new Error(data.error || "Upload failed");

      uploadStatus.classList.remove("muted");
      uploadStatus.classList.add("success");
      uploadStatus.textContent = `Added ${data.chunkCount} knowledge chunk${data.chunkCount === 1 ? "" : "s"} from "${data.filename}".`;
      loadItems();
      loadDocuments();
    } catch (err) {
      uploadStatus.classList.add("hidden");
      uploadError.textContent = err.message;
      uploadError.classList.remove("hidden");
    } finally {
      fileInput.value = "";
    }
  });

  async function openDocument(doc, forceDownload) {
    try {
      const resp = await fetch(`${API_BASE}/api/admin/${websiteId}/documents/${doc.id}/file`, {
        headers: { "X-Admin-Session": sessionToken },
      });
      if (resp.status === 401) {
        showLogin();
        throw new Error("Session expired, please log in again");
      }
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.error || "Could not open file");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      if (forceDownload) {
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(url, "_blank");
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      alert(err.message);
    }
  }

  async function removeDocument(id) {
    if (!confirm("Delete this document? Its extracted knowledge will also be removed.")) return;
    try {
      await api(`/api/admin/${websiteId}/documents/${id}`, { method: "DELETE" });
      loadItems();
      loadDocuments();
    } catch (err) {
      alert(err.message);
    }
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function loadDocuments() {
    const list = document.getElementById("docList");
    const empty = document.getElementById("docEmptyState");
    try {
      const docs = await api(`/api/admin/${websiteId}/documents`);
      document.getElementById("docCount").textContent = docs.length;
      list.innerHTML = "";
      empty.classList.toggle("hidden", docs.length > 0);
      for (const doc of docs) {
        const row = document.createElement("div");
        row.className = "item-row";
        row.innerHTML = `
          <div>
            <div class="item-title"></div>
            <div class="item-content"></div>
          </div>
          <div class="item-actions">
            <button class="secondary view-btn">View</button>
            <button class="secondary download-btn">Download</button>
            <button class="danger delete-btn">Delete</button>
          </div>
        `;
        row.querySelector(".item-title").textContent = doc.filename;
        row.querySelector(".item-content").textContent = `${formatBytes(doc.sizeBytes)} -- ${doc.chunkIds.length} knowledge chunk${doc.chunkIds.length === 1 ? "" : "s"} -- uploaded ${new Date(doc.uploadedAt).toLocaleString()}`;
        row.querySelector(".view-btn").addEventListener("click", () => openDocument(doc, false));
        row.querySelector(".download-btn").addEventListener("click", () => openDocument(doc, true));
        row.querySelector(".delete-btn").addEventListener("click", () => removeDocument(doc.id));
        list.appendChild(row);
      }
    } catch (err) {
      list.innerHTML = `<p class="error">${err.message}</p>`;
    }
  }

  if (sessionToken && websiteId) showApp();
})();
