import fs from "fs";
import path from "path";
import { createSession } from "./session";

interface CustomerUser {
  userId: string;
  username: string;
  password: string;
  name: string;
}

const DATA_DIR = path.resolve(__dirname, "../../data/users");

function loadUsers(websiteId: string): CustomerUser[] {
  const safeId = websiteId.replace(/[^a-zA-Z0-9_-]/g, "");
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, `${safeId}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Local-demo-only: plaintext passwords in a JSON file. This is
// intentionally the simplest thing that works for local testing -- a real
// deployment must hash passwords and use a real user store before this
// touches actual customer accounts.
export function customerLogin(websiteId: string, username: string, password: string): { token: string; name: string } | null {
  const user = loadUsers(websiteId).find((u) => u.username === username && u.password === password);
  if (!user) return null;
  const token = createSession({ websiteId, userId: user.userId, name: user.name });
  return { token, name: user.name };
}
