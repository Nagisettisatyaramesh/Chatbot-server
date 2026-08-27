import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../components/ui";

interface Conversation {
  id: string;
  visitorId: string;
  status: string;
  startedAt: string;
  lastMessageAt: string;
  _count: { messages: number };
}

export function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ conversations: Conversation[] }>("/api/conversations")
      .then((d) => setConversations(d.conversations))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Conversations" subtitle="Every chat your visitors have had with your bot" />
      {conversations.length === 0 ? (
        <EmptyState message="No conversations yet." />
      ) : (
        <Card className="divide-y divide-gray-100">
          {conversations.map((c) => (
            <Link key={c.id} to={`/conversations/${c.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
              <div>
                <div className="font-medium text-gray-900 text-sm">Visitor {c.visitorId.slice(0, 8)}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {c._count.messages} messages &middot; started {new Date(c.startedAt).toLocaleString()}
                </div>
              </div>
              <Badge tone={c.status === "HANDED_OFF" ? "yellow" : c.status === "CLOSED" ? "gray" : "green"}>{c.status}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
