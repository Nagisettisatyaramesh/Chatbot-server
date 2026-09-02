import { WidgetApi } from "./api";
import { buildStyles } from "./styles";
import { WebsiteConfig } from "./types";

// Capture the currently-executing <script> tag synchronously -- this only
// works before the first `await`, since document.currentScript is null
// once execution yields.
const currentScript = document.currentScript as HTMLScriptElement | null;

function readConfigFromScriptTag(): { websiteId: string; apiBase: string; chatEndpoint: string } | null {
  if (!currentScript) return null;
  const websiteId = currentScript.getAttribute("data-website-id");
  if (!websiteId) {
    console.error("[Chatbot] Missing required data-website-id attribute on the widget script tag.");
    return null;
  }
  const explicitBase = currentScript.getAttribute("data-api-base");
  let apiBase = explicitBase;
  if (!apiBase) {
    try {
      apiBase = new URL(currentScript.src).origin;
    } catch {
      apiBase = "";
    }
  }
  // Lets a demo/test page opt into the semantic-search engine instead of
  // the default keyword engine, without any other change -- same website,
  // same knowledge base, only the matching algorithm differs.
  const chatEndpoint = currentScript.getAttribute("data-chat-endpoint") || "/api/chat";
  return { websiteId, apiBase: apiBase ?? "", chatEndpoint };
}

function sessionStorageKey(websiteId: string): string {
  return `aiwa_session_${websiteId}`;
}

const KEYWORD_COLOR = "#4F46E5";
const SEMANTIC_COLOR = "#059669";
const LAUNCHER_GAP = 76; // px -- so two widgets on one page don't sit exactly on top of each other

class ChatWidget {
  private api: WidgetApi;
  private config: WebsiteConfig | null = null;
  private sending = false;
  private sessionToken: string | null = null;
  private pendingMessageAfterLogin: string | null = null;

  private root: ShadowRoot;
  private panelEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtnEl!: HTMLButtonElement;

  private isSemantic: boolean;

  constructor(private websiteId: string, apiBase: string, chatEndpoint: string, host: HTMLElement) {
    this.isSemantic = chatEndpoint !== "/api/chat";
    this.api = new WidgetApi(apiBase, websiteId, chatEndpoint);
    try {
      this.sessionToken = window.localStorage.getItem(sessionStorageKey(websiteId));
    } catch {
      this.sessionToken = null;
    }
    this.root = host.attachShadow({ mode: "open" });
  }

  async init() {
    const config = await this.api.getConfig();
    if (!config) return; // invalid/unknown websiteId -- render nothing
    this.config = config;
    this.render();
  }

  private render() {
    const cfg = this.config!;
    const color = this.isSemantic ? SEMANTIC_COLOR : KEYWORD_COLOR;
    const style = document.createElement("style");
    style.textContent = buildStyles(color, color);
    this.root.appendChild(style);

    const launcher = document.createElement("button");
    launcher.className = "aiwa-launcher";
    launcher.setAttribute("aria-label", "Open chat");
    launcher.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12a8 8 0 1 1 3.06 6.3L4 20l1.1-3.3A7.96 7.96 0 0 1 4 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if (this.isSemantic) {
      // Shift left so this widget doesn't sit exactly on top of a
      // keyword-engine widget also embedded on the same comparison page.
      launcher.style.right = `${20 + LAUNCHER_GAP}px`;
    }
    this.root.appendChild(launcher);

    const panel = document.createElement("div");
    panel.className = "aiwa-panel";
    panel.innerHTML = `
      <div class="aiwa-header">
        <div class="aiwa-avatar">🤖</div>
        <div class="aiwa-header-title"></div>
        <button class="aiwa-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="aiwa-messages"></div>
      <div class="aiwa-input-row">
        <input class="aiwa-input" type="text" placeholder="Type your question..." maxlength="2000" />
        <button class="aiwa-send" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20l16-8L4 4v6l10 2-10 2v6Z" fill="currentColor"/></svg>
        </button>
      </div>
    `;
    if (this.isSemantic) {
      panel.style.right = `${20 + LAUNCHER_GAP}px`;
    }
    this.root.appendChild(panel);
    this.panelEl = panel;

    const engineLabel = this.isSemantic ? " (Semantic)" : " (Keyword)";
    panel.querySelector<HTMLDivElement>(".aiwa-header-title")!.textContent = `🤖 ${cfg.businessName} Assistant${engineLabel}`;

    this.messagesEl = panel.querySelector(".aiwa-messages")!;
    this.inputEl = panel.querySelector(".aiwa-input")!;
    this.sendBtnEl = panel.querySelector(".aiwa-send")!;

    launcher.addEventListener("click", () => this.toggle());
    panel.querySelector(".aiwa-close")!.addEventListener("click", () => this.toggle());
    this.sendBtnEl.addEventListener("click", () => this.handleSend());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSend();
    });

    this.addBotMessage("Hi! How can I help you?");
  }

  private toggle() {
    const open = this.panelEl.classList.toggle("aiwa-open");
    if (open) this.inputEl.focus();
  }

  private scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private addMessageBubble(role: "user" | "assistant", content: string, isError = false) {
    const bubble = document.createElement("div");
    bubble.className = role === "user" ? "aiwa-msg aiwa-msg-user" : isError ? "aiwa-msg aiwa-msg-error" : "aiwa-msg aiwa-msg-bot";
    bubble.textContent = content; // textContent only -- never render model/user text as HTML
    this.messagesEl.appendChild(bubble);
    this.scrollToBottom();
  }

  private addBotMessage(content: string, isError = false) {
    this.addMessageBubble("assistant", content, isError);
  }

  private addUserMessage(content: string) {
    this.addMessageBubble("user", content);
  }

  private addCallButton(phone: string) {
    const a = document.createElement("a");
    a.className = "aiwa-call-btn";
    a.href = `tel:${phone.replace(/\s+/g, "")}`;
    a.textContent = "📞 Call Us";
    this.messagesEl.appendChild(a);
    this.scrollToBottom();
  }

  private showTyping(): () => void {
    const typing = document.createElement("div");
    typing.className = "aiwa-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    this.messagesEl.appendChild(typing);
    this.scrollToBottom();
    return () => typing.remove();
  }

  private showLoginForm(afterMessage: string) {
    this.pendingMessageAfterLogin = afterMessage;
    const form = document.createElement("div");
    form.className = "aiwa-login-form";
    form.innerHTML = `
      <input class="aiwa-login-username" type="text" placeholder="Username" />
      <input class="aiwa-login-password" type="password" placeholder="Password" />
      <div class="aiwa-login-error" style="display:none"></div>
      <div class="aiwa-login-form-row">
        <button class="aiwa-login-submit">Log In</button>
        <button class="aiwa-login-cancel">Cancel</button>
      </div>
    `;
    this.messagesEl.appendChild(form);
    this.scrollToBottom();

    const usernameEl = form.querySelector<HTMLInputElement>(".aiwa-login-username")!;
    const passwordEl = form.querySelector<HTMLInputElement>(".aiwa-login-password")!;
    const errorEl = form.querySelector<HTMLDivElement>(".aiwa-login-error")!;

    form.querySelector(".aiwa-login-cancel")!.addEventListener("click", () => {
      this.pendingMessageAfterLogin = null;
      form.remove();
    });

    const submit = async () => {
      errorEl.style.display = "none";
      try {
        const result = await this.api.login(usernameEl.value.trim(), passwordEl.value);
        this.sessionToken = result.sessionToken;
        try {
          window.localStorage.setItem(sessionStorageKey(this.websiteId), result.sessionToken);
        } catch {
          // storage unavailable -- session still works for this page view
        }
        form.remove();
        this.addBotMessage(`Logged in as ${result.name}.`);
        const pending = this.pendingMessageAfterLogin;
        this.pendingMessageAfterLogin = null;
        if (pending) await this.sendText(pending, false);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : "Login failed";
        errorEl.style.display = "block";
      }
    };

    form.querySelector(".aiwa-login-submit")!.addEventListener("click", submit);
    passwordEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  }

  private async handleSend() {
    const text = this.inputEl.value.trim();
    if (!text || this.sending) return;
    this.inputEl.value = "";
    await this.sendText(text, true);
  }

  private async sendText(text: string, showUserBubble: boolean) {
    if (this.sending) return;
    this.sending = true;
    this.sendBtnEl.disabled = true;
    if (showUserBubble) this.addUserMessage(text);

    const stopTyping = this.showTyping();
    try {
      const result = await this.api.sendMessage(text, this.sessionToken);
      stopTyping();
      this.addBotMessage(result.answer);
      if (result.requiresLogin) this.showLoginForm(text);
      if (result.humanFallback && result.callPhone) this.addCallButton(result.callPhone);
    } catch (err) {
      stopTyping();
      this.addBotMessage(
        err instanceof Error ? err.message : "I'm unable to provide that information right now. Would you like to speak with our team?",
        true
      );
      if (this.config?.humanPhone) this.addCallButton(this.config.humanPhone);
    } finally {
      this.sending = false;
      this.sendBtnEl.disabled = false;
    }
  }
}

function boot() {
  const parsed = readConfigFromScriptTag();
  if (!parsed || !parsed.apiBase) return;

  // Includes the endpoint in the host id so a demo/comparison page can
  // embed both the keyword and semantic widgets for the same websiteId at
  // once without one blocking the other's init.
  const hostId = `aiwa-host-${parsed.websiteId}-${parsed.chatEndpoint.replace(/[^a-z0-9]/gi, "_")}`;
  if (document.getElementById(hostId)) return; // avoid double-init if script included twice

  const host = document.createElement("div");
  host.id = hostId;
  document.body.appendChild(host);

  const widget = new ChatWidget(parsed.websiteId, parsed.apiBase, parsed.chatEndpoint, host);
  widget.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
