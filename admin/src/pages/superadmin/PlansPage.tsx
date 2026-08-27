import { FormEvent, useEffect, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { Button, Card, Input, Label, PageHeader, Spinner } from "../../components/ui";

interface Plan {
  id: string;
  name: string;
  messageLimit: number;
  priceMonthly: number;
}

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [messageLimit, setMessageLimit] = useState(1000);
  const [priceMonthly, setPriceMonthly] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<Plan[]>("/api/superadmin/plans").then(setPlans).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/superadmin/plans", { name: name.toUpperCase(), messageLimit, priceMonthly });
      setName("");
      setMessageLimit(1000);
      setPriceMonthly(0);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const updateLimit = async (plan: Plan, messageLimit: number) => {
    await api.put(`/api/superadmin/plans/${plan.id}`, { messageLimit });
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Subscription Plans" subtitle="Configure the message limits and pricing customers see" />

      <Card className="p-5 mb-6 max-w-xl">
        <form onSubmit={onCreate} className="grid grid-cols-3 gap-3 items-end">
          <div>
            <Label>Plan Name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ENTERPRISE" />
          </div>
          <div>
            <Label>Message Limit / mo</Label>
            <Input required type="number" min={1} value={messageLimit} onChange={(e) => setMessageLimit(parseInt(e.target.value, 10))} />
          </div>
          <div>
            <Label>Price / mo ($)</Label>
            <Input required type="number" min={0} value={priceMonthly} onChange={(e) => setPriceMonthly(parseFloat(e.target.value))} />
          </div>
          <div className="col-span-3">
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">{error}</div>}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add Plan"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-5">
            <div className="font-semibold text-gray-900">{plan.name}</div>
            <div className="text-2xl font-bold text-brand-700 mt-1">${plan.priceMonthly}<span className="text-sm text-gray-400 font-normal">/mo</span></div>
            <div className="mt-3">
              <Label>Message limit</Label>
              <Input type="number" defaultValue={plan.messageLimit} onBlur={(e) => updateLimit(plan, parseInt(e.target.value, 10))} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
