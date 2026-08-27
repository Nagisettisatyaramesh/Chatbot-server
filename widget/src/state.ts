function safeRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode, etc.) -- fall back to in-memory only
  }
}

export function getVisitorId(): string {
  const key = "aiwa_visitor_id";
  let id = safeGet(key);
  if (!id) {
    id = safeRandomId();
    safeSet(key, id);
  }
  return id;
}

export function getStoredConversationId(clientId: string): string | null {
  return safeGet(`aiwa_conversation_${clientId}`);
}

export function setStoredConversationId(clientId: string, conversationId: string): void {
  safeSet(`aiwa_conversation_${clientId}`, conversationId);
}
