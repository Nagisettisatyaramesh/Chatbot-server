import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Card, EmptyState, PageHeader, Spinner } from "../../components/ui";

interface AuditEntry {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  customerId: string | null;
  detail: string | null;
  createdAt: string;
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AuditEntry[]>("/api/superadmin/audit-log").then(setLogs).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Every cross-tenant action taken by a super admin is recorded here" />
      {logs.length === 0 ? (
        <EmptyState message="No audit entries yet." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {logs.map((log) => (
            <div key={log.id} className="px-5 py-3 text-sm flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">{log.action}</span>
                <span className="text-gray-400"> by {log.actorEmail}</span>
                {log.detail && <span className="text-gray-400"> &middot; {log.detail}</span>}
              </div>
              <div className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
