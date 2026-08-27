export interface WidgetConfig {
  businessName: string;
  botName: string;
  welcomeMessage: string;
  avatarUrl: string | null;
  primaryColor: string;
  buttonColor: string;
  quickReplies: string[];
  leadCaptureEnabled: boolean;
  handoff: HandoffConfig;
}

export interface HandoffConfig {
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  enquiryUrl: string | null;
}

export interface ChatResponse {
  conversationId: string;
  message: string;
  quickReplies: string[];
  humanHandoff: boolean;
  handoff: HandoffConfig | null;
}

export interface LeadStepResponse {
  conversationId: string;
  message: string;
  done?: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  humanHandoff?: boolean;
  handoff?: HandoffConfig | null;
}
