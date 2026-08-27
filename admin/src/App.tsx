import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { AppLayout, ProtectedRoute } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { BusinessProfilePage } from "./pages/BusinessProfilePage";
import { ChatbotSettingsPage } from "./pages/ChatbotSettingsPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { ConversationsPage } from "./pages/ConversationsPage";
import { ConversationDetailPage } from "./pages/ConversationDetailPage";
import { LeadsPage } from "./pages/LeadsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { InstallPage } from "./pages/InstallPage";
import { SuperAdminDashboardPage } from "./pages/superadmin/SuperAdminDashboardPage";
import { CustomersPage } from "./pages/superadmin/CustomersPage";
import { PlansPage } from "./pages/superadmin/PlansPage";
import { AuditLogPage } from "./pages/superadmin/AuditLogPage";

function HomeRedirect() {
  const { isSuperAdmin } = useAuth();
  return <Navigate to={isSuperAdmin ? "/superadmin" : "/dashboard"} replace />;
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<BusinessProfilePage />} />
            <Route path="/knowledge" element={<KnowledgeBasePage />} />
            <Route path="/settings" element={<ChatbotSettingsPage />} />
            <Route path="/conversations" element={<ConversationsPage />} />
            <Route path="/conversations/:id" element={<ConversationDetailPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/install" element={<InstallPage />} />

            <Route
              path="/superadmin"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <SuperAdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/superadmin/customers"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/superadmin/plans"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <PlansPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/superadmin/audit-log"
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AuditLogPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
