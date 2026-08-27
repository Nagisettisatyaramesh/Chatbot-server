import { FormEvent, useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { Button, Card, EmptyState, PageHeader, Spinner, Textarea } from "../components/ui";

interface UnansweredQuestion {
  id: string;
  question: string;
  occurrences: number;
  lastAskedAt: string;
}

export function AnalyticsPage() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get<UnansweredQuestion[]>("/api/analytics/unanswered").then(setQuestions).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submitAnswer = async (e: FormEvent, id: string) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/analytics/unanswered/${id}/convert`, { answer: answerText });
      setAnswering(null);
      setAnswerText("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save answer");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Unanswered Questions"
        subtitle="Questions your chatbot couldn't confidently answer. Add an answer to teach it -- it becomes an FAQ immediately."
      />
      {questions.length === 0 ? (
        <EmptyState message="No unanswered questions right now. Nice!" />
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card key={q.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">{q.question}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Asked {q.occurrences} time{q.occurrences === 1 ? "" : "s"} &middot; last asked {new Date(q.lastAskedAt).toLocaleDateString()}
                  </div>
                </div>
                {answering !== q.id && (
                  <Button className="!px-3 !py-1.5 text-xs shrink-0" onClick={() => { setAnswering(q.id); setAnswerText(""); }}>
                    Add Answer
                  </Button>
                )}
              </div>
              {answering === q.id && (
                <form onSubmit={(e) => submitAnswer(e, q.id)} className="mt-3 space-y-2">
                  <Textarea required rows={3} value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Write the answer to add as an FAQ..." />
                  {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
                  <div className="flex gap-2">
                    <Button type="submit" className="!px-3 !py-1.5 text-xs" disabled={saving}>
                      {saving ? "Saving..." : "Save as FAQ"}
                    </Button>
                    <Button type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setAnswering(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
