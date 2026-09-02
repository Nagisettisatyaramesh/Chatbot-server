import { randomUUID } from "crypto";

// Minimal in-memory session store for local-first testing -- resets on
// server restart, which is fine for a local prototype. A real deployment
// would swap this for a real session/JWT store without changing the
// calling code's interface (createSession/getSession/deleteSession).
interface SessionData {
  websiteId: string;
  [key: string]: unknown;
}

const sessions = new Map<string, SessionData>();

export function createSession(data: SessionData): string {
  const token = randomUUID();
  sessions.set(token, data);
  return token;
}

// Every session is tagged with the websiteId it was created for. Callers
// must pass the websiteId they expect and this rejects any mismatch --
// a customer or admin token issued for one website can never be used to
// read or act on another website's data.
export function getSession(token: string | undefined, expectedWebsiteId: string): SessionData | null {
  if (!token) return null;
  const data = sessions.get(token);
  if (!data || data.websiteId !== expectedWebsiteId) return null;
  return data;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
}
