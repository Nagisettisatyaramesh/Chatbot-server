export interface WebsiteConfig {
  businessName: string;
  humanPhone: string | null;
}

export interface ChatDebugInfo {
  sources: {
    database: boolean;
    website: boolean;
    knowledgeBase: boolean;
    humanFallback: boolean;
  };
}

export interface ChatResponse {
  answer: string;
  humanFallback: boolean;
  requiresLogin: boolean;
  callPhone: string | null;
  debug?: ChatDebugInfo;
}

export interface LoginResponse {
  sessionToken: string;
  name: string;
}
