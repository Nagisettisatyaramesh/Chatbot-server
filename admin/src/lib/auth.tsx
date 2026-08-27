import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { api, setToken } from "./api";

export type Role = "OWNER" | "STAFF" | "SUPER_ADMIN";

interface AuthState {
  token: string | null;
  role: Role | null;
  customerId: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (businessName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}

const STORAGE_KEY = "aiwa_admin_auth";

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, role: null, customerId: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, role: null, customerId: null };
  }
}

function saveState(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState);

  const login = async (email: string, password: string) => {
    const resp = await api.post<{ token: string; role: Role; customerId: string | null }>("/api/auth/login", {
      email,
      password,
    });
    setToken(resp.token);
    const next = { token: resp.token, role: resp.role, customerId: resp.customerId };
    saveState(next);
    setState(next);
  };

  const register = async (businessName: string, email: string, password: string) => {
    const resp = await api.post<{ token: string; customer: { id: string } }>("/api/auth/register", {
      businessName,
      email,
      password,
    });
    setToken(resp.token);
    const next = { token: resp.token, role: "OWNER" as Role, customerId: resp.customer.id };
    saveState(next);
    setState(next);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
    setState({ token: null, role: null, customerId: null });
  };

  // A 401 from any API call (expired/invalid token) must clear the React
  // auth state, not just localStorage -- otherwise ProtectedRoute keeps
  // believing the user is signed in and bounces them straight back to the
  // page that just failed, looping forever. See api.ts's 401 handler.
  useEffect(() => {
    window.addEventListener("aiwa:unauthorized", logout);
    return () => window.removeEventListener("aiwa:unauthorized", logout);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      isAuthenticated: !!state.token,
      isSuperAdmin: state.role === "SUPER_ADMIN",
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
