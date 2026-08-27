import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { BarChart, Card, PageHeader, Spinner, StatCard } from "../components/ui";

interface DashboardData {
  totalConversations: number;
  conversationsToday: number;
  totalLeads: number;
  newLeads: number;
  questionsAnswered: number;
  questionsTransferred: number;
  uniqueVisitors: number;
  avgConversationLength: number;
  usage: { used: number; limit: number; plan: string; periodStart: string };
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardData>("/api/analytics/dashboard").then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return null;

  const usagePct = data.usage.limit > 0 ? Math.min(100, (data.usage.used / data.usage.limit) * 100) : 0;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="An overview of your chatbot's performance" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Conversations" value={data.totalConversations} />
        <StatCard label="Conversations Today" value={data.conversationsToday} />
        <StatCard label="Total Leads" value={data.totalLeads} hint={`${data.newLeads} new`} />
        <StatCard label="Unique Visitors" value={data.uniqueVisitors} />
        <StatCard label="Questions Answered" value={data.questionsAnswered} />
        <StatCard label="Transferred to Human" value={data.questionsTransferred} />
        <StatCard label="Avg. Conversation Length" value={data.avgConversationLength} hint="messages" />
        <StatCard label="Plan" value={data.usage.plan} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="font-semibold text-gray-900 mb-4">Question Handling</div>
          <BarChart
            data={[
              { label: "Answered", value: data.questionsAnswered },
              { label: "Transferred", value: data.questionsTransferred },
            ]}
          />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-gray-900">Monthly Usage</div>
            <span className="text-sm text-gray-500">
              {data.usage.used} / {data.usage.limit} messages
            </span>
          </div>
          <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${usagePct > 90 ? "bg-red-500" : usagePct > 70 ? "bg-yellow-500" : "bg-brand-500"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Usage period started {new Date(data.usage.periodStart).toLocaleDateString()}. Resets automatically every 30 days.
          </p>
        </Card>
      </div>
    </div>
  );
}
