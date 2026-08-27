import { WidgetApi } from "./api";
import { buildStyles } from "./styles";
import { getVisitorId, getStoredConversationId, setStoredConversationId } from "./state";
import { ChatMessage, HandoffConfig, WidgetConfig } from "./types";

// Capture the currently-executing <script> tag synchronously -- this only
// works before the first `await`, since document.currentScript is null
// once execution yields.
const currentScript = document.currentScript as HTMLScriptElement | null;

function readConfigFromScriptTag(): { clientId: string; apiBase: string } | null {
  if (!currentScript) return null;
  const clientId = currentScript.getAttribute("data-client-id");
  if (!clientId) {
    console.error("[AI Website Assistant] Missing required data-client-id attribute on the widget script tag.");
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
  return { clientId, apiBase: apiBase ?? "" };
}

function escapeAttr(v: string): string {
  return v.replace(/"/g, "&quot;");
}

class ChatWidget {
  private api: WidgetApi;
  private clientId: string;
  private visitorId: string;
  private conversationId: string | null;
  private config: WidgetConfig | null = null;
  private messages: ChatMessage[] = [];
  private leadCaptureActive = false;
  private sending = false;

  private root: ShadowRoot;
  private panelEl!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private quickRepliesEl!: HTMLDivElement;
  private handoffPanelEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtnEl!: HTMLButtonElement;
  private launcherEl!: HTMLButtonElement;

  constructor(clientId: string, apiBase: string, host: HTMLElement) {
    this.clientId = clientId;
    this.api = new WidgetApi(apiBase, clientId);
    this.visitorId = getVisitorId();
    this.conversationId = getStoredConversationId(clientId);
    this.root = host.attachShadow({ mode: "open" });
  }

  async init() {
    const config = await this.api.getConfig();
    if (!config) return; // invalid/disabled clientId -- render nothing
    this.config = config;
    this.render();
  }

  private render() {
    const cfg = this.config!;
    const style = document.createElement("style");
    style.textContent = buildStyles(cfg.primaryColor, cfg.buttonColor);
    this.root.appendChild(style);

    const launcher = document.createElement("button");
    launcher.className = "aiwa-launcher";
    launcher.setAttribute("aria-label", "Open chat");
    launcher.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12a8 8 0 1 1 3.06 6.3L4 20l1.1-3.3A7.96 7.96 0 0 1 4 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    this.launcherEl = launcher;
    this.root.appendChild(launcher);

    const panel = document.createElement("div");
    panel.className = "aiwa-panel";
    panel.innerHTML = `
      <div class="aiwa-header">
        <div class="aiwa-avatar">${
          cfg.avatarUrl ? `<img src="${escapeAttr(cfg.avatarUrl)}" alt="" />` : "🤖"
        }</div>
        <div class="aiwa-header-text">
          <div class="aiwa-header-title"></div>
          <div class="aiwa-header-subtitle"></div>
        </div>
        <button class="aiwa-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="aiwa-messages"></div>
      <div class="aiwa-quick-replies"></div>
      <div class="aiwa-handoff-panel" style="display:none"></div>
      <div class="aiwa-input-row">
        <input class="aiwa-input" type="text" placeholder="Type your message..." maxlength="2000" />
        <button class="aiwa-send" aria-label="Send">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20l16-8L4 4v6l10 2-10 2v6Z" fill="currentColor"/></svg>
        </button>
      </div>
      <div class="aiwa-footer-link">Powered by AI Website Assistant</div>
    `;
    this.root.appendChild(panel);
    this.panelEl = panel;

    panel.querySelector<HTMLDivElement>(".aiwa-header-title")!.textContent = cfg.botName;
    panel.querySelector<HTMLDivElement>(".aiwa-header-subtitle")!.textContent = cfg.businessName;

    this.messagesEl = panel.querySelector(".aiwa-messages")!;
    this.quickRepliesEl = panel.querySelector(".aiwa-quick-replies")!;
    this.handoffPanelEl = panel.querySelector(".aiwa-handoff-panel")!;
    this.inputEl = panel.querySelector(".aiwa-input")!;
    this.sendBtnEl = panel.querySelector(".aiwa-send")!;

    launcher.addEventListener("click", () => this.toggle());
    panel.querySelector(".aiwa-close")!.addEventListener("click", () => this.toggle());
    this.sendBtnEl.addEventListener("click", () => this.handleSend());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.handleSend();
    });

    this.addBotMessage(cfg.welcomeMessage);
    this.renderQuickReplies(cfg.quickReplies);
    // Avoid rendering a second, visually-duplicate "Talk to Human" button if
    // the business already configured one as a quick reply themselves.
    const alreadyHasHandoffQuickReply = cfg.quickReplies.some(
      (r) => r.trim().toLowerCase().replace(/[^a-z\s]/g, "").trim() === "talk to human"
    );
    if (!alreadyHasHandoffQuickReply) this.renderPersistentHandoffAccess();
  }

  private toggle() {
    const open = this.panelEl.classList.toggle("aiwa-open");
    if (open) this.inputEl.focus();
  }

  private scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  private addMessageBubble(role: "user" | "assistant", content: string) {
    const bubble = document.createElement("div");
    bubble.className = role === "user" ? "aiwa-msg aiwa-msg-user" : "aiwa-msg aiwa-msg-bot";
    bubble.textContent = content; // textContent only -- never render model/user text as HTML
    this.messagesEl.appendChild(bubble);
    this.scrollToBottom();
  }

  private addBotMessage(content: string) {
    this.messages.push({ role: "assistant", content });
    this.addMessageBubble("assistant", content);
  }

  private addUserMessage(content: string) {
    this.messages.push({ role: "user", content });
    this.addMessageBubble("user", content);
  }

  private showTyping(): () => void {
    const typing = document.createElement("div");
    typing.className = "aiwa-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    this.messagesEl.appendChild(typing);
    this.scrollToBottom();
    return () => typing.remove();
  }

  private renderQuickReplies(replies: string[]) {
    this.quickRepliesEl.innerHTML = "";
    for (const reply of replies.slice(0, 4)) {
      const btn = document.createElement("button");
      btn.className = "aiwa-quick-reply";
      btn.textContent = reply;
      // A business owner configuring their own quick replies (Chatbot
      // Settings -> Quick Reply Suggestions) could easily type something
      // like "Talk to Human" themselves, not realizing the widget already
      // appends its own working one via renderPersistentHandoffAccess().
      // Without this check that creates two visually-similar buttons where
      // only one actually opens the handoff panel -- the other just sends
      // "Talk to Human" as a literal chat message. Treat any quick reply
      // that reads that way (regardless of emoji/casing) as the real thing.
      if (reply.trim().toLowerCase().replace(/[^a-z\s]/g, "").trim() === "talk to human") {
        btn.addEventListener("click", () => this.openHandoffPanel(this.config!.handoff));
      } else {
        btn.addEventListener("click", () => this.sendText(reply));
      }
      this.quickRepliesEl.appendChild(btn);
    }
  }

  private addTalkToHumanButton(handoff: HandoffConfig) {
    const btn = document.createElement("button");
    btn.className = "aiwa-handoff-btn";
    btn.textContent = "💬 Talk to Human";
    btn.addEventListener("click", () => this.openHandoffPanel(handoff));
    this.messagesEl.appendChild(btn);
    this.scrollToBottom();
  }

  private renderPersistentHandoffAccess() {
    // A small always-visible way to reach a human even before any fallback happens.
    const link = document.createElement("button");
    link.className = "aiwa-quick-reply";
    link.textContent = "💬 Talk to Human";
    link.addEventListener("click", () => this.openHandoffPanel(this.config!.handoff));
    this.quickRepliesEl.appendChild(link);
  }

  private openHandoffPanel(handoff: HandoffConfig) {
    const panel = this.handoffPanelEl;
    panel.innerHTML = `<div class="aiwa-handoff-panel-title">How would you like to contact us?</div>`;
    panel.style.display = "flex";

    if (handoff.whatsapp) {
      const cleaned = handoff.whatsapp.replace(/[^\d+]/g, "").replace(/^\+/, "");
      const a = document.createElement("a");
      a.className = "aiwa-handoff-option";
      a.href = `https://wa.me/${cleaned}`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "💬 WhatsApp";
      panel.appendChild(a);
    }
    if (handoff.phone) {
      const a = document.createElement("a");
      a.className = "aiwa-handoff-option";
      a.href = `tel:${handoff.phone.replace(/\s+/g, "")}`;
      a.textContent = "📞 Call Us";
      panel.appendChild(a);
    }
    if (this.config?.leadCaptureEnabled) {
      const btn = document.createElement("button");
      btn.className = "aiwa-handoff-option";
      btn.textContent = "📝 Submit Enquiry";
      btn.addEventListener("click", () => this.startEnquiry());
      panel.appendChild(btn);
    }
    if (handoff.enquiryUrl) {
      const a = document.createElement("a");
      a.className = "aiwa-handoff-option";
      a.href = handoff.enquiryUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "🔗 Open Enquiry Form";
      panel.appendChild(a);
    }
    if (!handoff.whatsapp && !handoff.phone && !handoff.enquiryUrl && !this.config?.leadCaptureEnabled) {
      const p = document.createElement("div");
      p.textContent = handoff.email ? `Please email us at ${handoff.email}` : "Please contact the business directly.";
      panel.appendChild(p);
    }
  }

  private closeHandoffPanel() {
    this.handoffPanelEl.style.display = "none";
    this.handoffPanelEl.innerHTML = "";
  }

  private async startEnquiry() {
    this.closeHandoffPanel();
    this.leadCaptureActive = true;
    const stopTyping = this.showTyping();
    try {
      const result = await this.api.startLead(this.visitorId, this.conversationId);
      this.conversationId = result.conversationId;
      setStoredConversationId(this.clientId, this.conversationId);
      stopTyping();
      this.addBotMessage(result.message);
    } catch (err) {
      stopTyping();
      this.addBotMessage(err instanceof Error ? err.message : "Something went wrong.");
      this.leadCaptureActive = false;
    }
  }

  private async handleSend() {
    const text = this.inputEl.value.trim();
    if (!text || this.sending) return;
    this.inputEl.value = "";
    this.sendText(text);
  }

  private async sendText(text: string) {
    if (this.sending) return;
    this.sending = true;
    this.sendBtnEl.disabled = true;
    this.closeHandoffPanel();
    this.addUserMessage(text);

    const stopTyping = this.showTyping();
    try {
      if (this.leadCaptureActive) {
        if (!this.conversationId) throw new Error("Enquiry session expired, please try again.");
        const result = await this.api.replyLead(this.conversationId, text);
        stopTyping();
        this.addBotMessage(result.message);
        if (result.done) this.leadCaptureActive = false;
      } else {
        const result = await this.api.sendMessage(this.visitorId, text, this.conversationId);
        this.conversationId = result.conversationId;
        setStoredConversationId(this.clientId, this.conversationId);
        stopTyping();
        this.addBotMessage(result.message);
        if (result.quickReplies.length > 0) this.renderQuickReplies([...result.quickReplies, "Talk to Human"]);
        if (result.humanHandoff && result.handoff) this.addTalkToHumanButton(result.handoff);
      }
    } catch (err) {
      stopTyping();
      this.addBotMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      this.sending = false;
      this.sendBtnEl.disabled = false;
    }
  }
}

function boot() {
  const parsed = readConfigFromScriptTag();
  if (!parsed || !parsed.apiBase) return;

  const hostId = `aiwa-host-${parsed.clientId}`;
  if (document.getElementById(hostId)) return; // avoid double-init if script included twice

  const host = document.createElement("div");
  host.id = hostId;
  document.body.appendChild(host);

  const widget = new ChatWidget(parsed.clientId, parsed.apiBase, host);
  widget.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
