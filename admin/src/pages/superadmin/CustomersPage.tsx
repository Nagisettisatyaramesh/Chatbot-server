import { FormEvent, useEffect, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { Badge, Button, Card, Input, Label, PageHeader, Spinner } from "../../components/ui";

interface Customer {
  id: string;
  clientId: string;
  businessName: string;
  plan: string;
  status: string;
  messageLimit: number;
  messagesUsed: number;
  createdAt: string;
  _count: { conversations: number; leads: number };
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [plan, setPlan] = useState("STARTER");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<Customer[]>("/api/superadmin/customers").then(setCustomers).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/superadmin/customers", { businessName, ownerEmail, ownerPassword, plan });
      setShowForm(false);
      setBusinessName("");
      setOwnerEmail("");
      setOwnerPassword("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c: Customer) => {
    const status = c.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await api.put(`/api/superadmin/customers/${c.id}`, { status });
    load();
  };

  const changePlan = async (c: Customer, newPlan: string) => {
    const limits: Record<string, number> = { STARTER: 1000, BUSINESS: 5000, PREMIUM: 20000 };
    await api.put(`/api/superadmin/customers/${c.id}`, { plan: newPlan, messageLimit: limits[newPlan] });
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Every business using AI Website Assistant"
        action={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Cancel" : "+ New Customer"}</Button>}
      />

      {showForm && (
        <Card className="p-5 mb-6 max-w-xl">
          <form onSubmit={onCreate} className="space-y-4">
            <div>
              <Label>Business Name</Label>
              <Input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Owner Email</Label>
                <Input required type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
              </div>
              <div>
                <Label>Owner Password</Label>
                <Input required type="password" minLength={8} value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Plan</Label>
              <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="STARTER">Starter (1,000 msgs/mo)</option>
                <option value="BUSINESS">Business (5,000 msgs/mo)</option>
                <option value="PREMIUM">Premium (20,000 msgs/mo)</option>
              </select>
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Customer"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-5 py-3 font-medium">Business</th>
              <th className="px-5 py-3 font-medium">Client ID</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Usage</th>
              <th className="px-5 py-3 font-medium">Conversations</th>
              <th className="px-5 py-3 font-medium">Leads</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 font-medium text-gray-900">{c.businessName}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.clientId}</td>
                <td className="px-5 py-3">
                  <select value={c.plan} onChange={(e) => changePlan(c, e.target.value)} className="text-xs rounded-full px-2.5 py-1 font-medium border-0 bg-gray-100">
                    <option value="STARTER">STARTER</option>
                    <option value="BUSINESS">BUSINESS</option>
                    <option value="PREMIUM">PREMIUM</option>
                  </select>
                </td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {c.messagesUsed} / {c.messageLimit}
                </td>
                <td className="px-5 py-3 text-gray-600">{c._count.conversations}</td>
                <td className="px-5 py-3 text-gray-600">{c._count.leads}</td>
                <td className="px-5 py-3">
                  <Badge tone={c.status === "ACTIVE" ? "green" : "red"}>{c.status}</Badge>
                </td>
                <td className="px-5 py-3">
                  <button className="text-xs font-medium text-brand-600" onClick={() => toggleStatus(c)}>
                    {c.status === "ACTIVE" ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
