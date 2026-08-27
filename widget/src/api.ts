import { ChatResponse, LeadStepResponse, WidgetConfig } from "./types";

export class WidgetApi {
  constructor(private baseUrl: string, private clientId: string) {}

  async getConfig(): Promise<WidgetConfig | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/widget/config/${encodeURIComponent(this.clientId)}`);
      if (!resp.ok) return null;
      return (await resp.json()) as WidgetConfig;
    } catch {
      return null;
    }
  }

  async sendMessage(visitorId: string, message: string, conversationId: string | null): Promise<ChatResponse> {
    const resp = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: this.clientId, visitorId, message, conversationId: conversationId ?? undefined }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? "Something went wrong. Please try again.");
    }
    return resp.json();
  }

  async startLead(visitorId: string, conversationId: string | null): Promise<LeadStepResponse> {
    const resp = await fetch(`${this.baseUrl}/api/chat/lead/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: this.clientId, visitorId, conversationId: conversationId ?? undefined }),
    });
    if (!resp.ok) throw new Error("Could not start enquiry.");
    return resp.json();
  }

  async replyLead(conversationId: string, answer: string): Promise<LeadStepResponse> {
    const resp = await fetch(`${this.baseUrl}/api/chat/lead/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: this.clientId, conversationId, answer }),
    });
    if (!resp.ok) throw new Error("Could not continue enquiry.");
    return resp.json();
  }
}
