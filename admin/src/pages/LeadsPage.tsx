import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Card, EmptyState, PageHeader, Spinner } from "../components/ui";

interface Lead {
  id: string;
  name: string | null;
  mobile: string | null;
  email: string | null;
  requirement: string | null;
  status: string;
  createdAt: string;
}

const STATUS_OPTIONS = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"];

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get<Lead[]>("/api/leads").then(setLeads).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateStatus = async (id: string, status: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await api.put(`/api/leads/${id}`, { status });
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Leads" subtitle="Enquiries your chatbot has collected from visitors" />
      {leads.length === 0 ? (
        <EmptyState message="No leads yet." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Mobile</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Requirement</th>
                <th className="px-5 py-3 font-medium">Received</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-gray-900">{lead.name ?? "-"}</td>
                  <td className="px-5 py-3 text-gray-600">{lead.mobile ?? "-"}</td>
                  <td className="px-5 py-3 text-gray-600">{lead.email ?? "-"}</td>
                  <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{lead.requirement ?? "-"}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className="text-xs rounded-full px-2.5 py-1 font-medium cursor-pointer border-0 bg-gray-100"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
