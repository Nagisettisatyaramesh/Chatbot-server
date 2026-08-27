import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

const customerNav = [
  { to: "/dashboard", label: "Dashboard", icon: "📊", end: true },
  { to: "/profile", label: "Business Profile", icon: "🏢" },
  { to: "/knowledge", label: "Knowledge Base", icon: "📚" },
  { to: "/settings", label: "Chatbot Settings", icon: "🤖" },
  { to: "/conversations", label: "Conversations", icon: "💬" },
  { to: "/leads", label: "Leads", icon: "🧾" },
  { to: "/analytics", label: "Analytics", icon: "📈" },
  { to: "/install", label: "Install Chatbot", icon: "🔌" },
];

const superAdminNav = [
  { to: "/superadmin", label: "Overview", icon: "🛡️", end: true },
  { to: "/superadmin/customers", label: "Customers", icon: "🏬" },
  { to: "/superadmin/plans", label: "Plans", icon: "💳" },
  { to: "/superadmin/audit-log", label: "Audit Log", icon: "📜" },
];

export function ProtectedRoute({ children, requireSuperAdmin = false }: { children: React.ReactNode; requireSuperAdmin?: boolean }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppLayout() {
  const { logout, isSuperAdmin } = useAuth();
  const nav = isSuperAdmin ? superAdminNav : customerNav;

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="font-extrabold text-lg text-brand-700">AI Website Assistant</div>
          <div className="text-xs text-gray-400 mt-0.5">{isSuperAdmin ? "Super Admin" : "Business Portal"}</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item ? item.end : false}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={logout} className="w-full text-left rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50">
            🚪 Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-8">
        <Outlet />
      </main>
    </div>
  );
}
