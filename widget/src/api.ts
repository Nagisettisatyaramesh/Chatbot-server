import { ChatResponse, LoginResponse, WebsiteConfig } from "./types";

export class WidgetApi {
  // chatEndpoint defaults to the keyword engine; a demo/test page can opt
  // into the semantic engine via the widget script tag's
  // data-chat-endpoint="/api/chat-semantic" attribute -- same website,
  // same knowledge, only the matching algorithm differs.
  constructor(private baseUrl: string, private websiteId: string, private chatEndpoint: string = "/api/chat") {}

  async getConfig(): Promise<WebsiteConfig | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/website-config/${encodeURIComponent(this.websiteId)}`);
      if (!resp.ok) return null;
      return (await resp.json()) as WebsiteConfig;
    } catch {
      return null;
    }
  }

  async sendMessage(message: string, sessionToken: string | null): Promise<ChatResponse> {
    const resp = await fetch(`${this.baseUrl}${this.chatEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId: this.websiteId, message, sessionToken: sessionToken ?? undefined }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error ?? "Something went wrong. Please try again.");
    }
    return resp.json();
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const resp = await fetch(`${this.baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteId: this.websiteId, username, password }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(body.error ?? "Invalid username or password");
    return body;
  }
}
