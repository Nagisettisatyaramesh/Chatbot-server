import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader, Spinner, StatCard } from "../../components/ui";

interface Stats {
  customers: number;
  activeBots: number;
  conversations: number;
  leads: number;
}

export function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/api/superadmin/stats").then(setStats);
  }, []);

  if (!stats) return <Spinner />;

  return (
    <div>
      <PageHeader title="Super Admin" subtitle="Platform-wide overview across every business on AI Website Assistant" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Customers" value={stats.customers} />
        <StatCard label="Active Bots" value={stats.activeBots} />
        <StatCard label="Conversations" value={stats.conversations} />
        <StatCard label="Leads" value={stats.leads} />
      </div>
    </div>
  );
}
