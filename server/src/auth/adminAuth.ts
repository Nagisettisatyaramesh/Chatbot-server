import fs from "fs";
import path from "path";
import { createSession, getSession } from "./session";

interface AdminUser {
  websiteId: string;
  username: string;
  password: string;
}

const ADMIN_FILE = path.resolve(__dirname, "../../data/admin-users.json");

function loadAdmins(): AdminUser[] {
  try {
    return JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveAdmins(admins: AdminUser[]): void {
  fs.mkdirSync(path.dirname(ADMIN_FILE), { recursive: true });
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(admins, null, 2), "utf-8");
}

// Local-demo-only: plaintext passwords in a JSON file, same caveat as
// customerAuth.ts. Admin sessions are tagged role: "admin" so the
// admin-only middleware can tell them apart from customer sessions even
// though both live in the same generic session store.
export function adminLogin(websiteId: string, username: string, password: string): string | null {
  const admin = loadAdmins().find((a) => a.websiteId === websiteId && a.username === username && a.password === password);
  if (!admin) return null;
  return createSession({ websiteId, role: "admin" });
}

export function isValidAdminSession(token: string | undefined, websiteId: string): boolean {
  const session = getSession(token, websiteId);
  return !!session && session.role === "admin";
}

// Called once, at self-service registration time, to create the admin
// account for a newly registered website (see routes/register.routes.ts).
export function registerAdmin(websiteId: string, username: string, password: string): void {
  const admins = loadAdmins();
  admins.push({ websiteId, username, password });
  saveAdmins(admins);
}
