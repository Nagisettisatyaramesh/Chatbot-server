import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Badge, Card, Spinner } from "../components/ui";

interface Message {
  id: string;
  role: string;
  content: string;
  wasFallback: boolean;
  createdAt: string;
}

interface ConversationDetail {
  id: string;
  visitorId: string;
  status: string;
  messages: Message[];
}

export function ConversationDetailPage() {
  const { id } = useParams();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);

  useEffect(() => {
    if (id) api.get<ConversationDetail>(`/api/conversations/${id}`).then(setConversation);
  }, [id]);

  if (!conversation) return <Spinner />;

  return (
    <div className="max-w-2xl">
      <Link to="/conversations" className="text-sm text-brand-600 font-medium">
        &larr; Back to Conversations
      </Link>
      <div className="flex items-center justify-between mt-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Visitor {conversation.visitorId.slice(0, 8)}</h1>
        <Badge tone={conversation.status === "HANDED_OFF" ? "yellow" : "green"}>{conversation.status}</Badge>
      </div>
      <Card className="p-5 space-y-3 bg-gray-50">
        {conversation.messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "USER" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "USER" ? "bg-brand-600 text-white" : m.wasFallback ? "bg-yellow-50 border border-yellow-200 text-gray-800" : "bg-white border border-gray-200 text-gray-800"
              }`}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              <div className={`text-[10px] mt-1 ${m.role === "USER" ? "text-brand-100" : "text-gray-400"}`}>{new Date(m.createdAt).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
