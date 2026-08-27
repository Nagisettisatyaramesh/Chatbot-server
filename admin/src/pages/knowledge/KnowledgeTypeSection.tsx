import { FormEvent, useEffect, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { Badge, Button, Card, EmptyState, Input, Label, Spinner, Textarea } from "../../components/ui";
import { KnowledgeItem } from "./types";

const TYPE_LABELS: Record<string, { title: string; contentLabel: string; hasPrice: boolean; placeholder: string }> = {
  ABOUT: { title: "About", contentLabel: "Details", hasPrice: false, placeholder: "e.g. Company History, Our Locations" },
  SERVICE: { title: "Service", contentLabel: "Description", hasPrice: true, placeholder: "e.g. Wedding Photography" },
  FAQ: { title: "Question", contentLabel: "Answer", hasPrice: false, placeholder: "e.g. What are your business hours?" },
  POLICY: { title: "Policy", contentLabel: "Details", hasPrice: false, placeholder: "e.g. Cancellation Policy" },
};

export function KnowledgeTypeSection({ type }: { type: "ABOUT" | "SERVICE" | "FAQ" | "POLICY" }) {
  const meta = TYPE_LABELS[type];
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KnowledgeItem | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get<KnowledgeItem[]>(`/api/knowledge?type=${type}`)
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(load, [type]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setPrice("");
    setShowForm(false);
    setError(null);
  };

  const startEdit = (item: KnowledgeItem) => {
    setEditing(item);
    setTitle(item.title);
    setContent(item.content);
    setPrice(item.price ?? "");
    setShowForm(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { type, title, content, price: meta.hasPrice ? price || null : null, status: "ACTIVE" };
      if (editing) await api.put(`/api/knowledge/${editing.id}`, payload);
      else await api.post("/api/knowledge", payload);
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await api.delete(`/api/knowledge/${id}`);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      {!showForm && (
        <Button onClick={() => setShowForm(true)}>+ Add {meta.title}</Button>
      )}

      {showForm && (
        <Card className="p-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>{meta.title === "Question" ? "Question" : "Title"}</Label>
              <Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={meta.placeholder} />
            </div>
            {meta.hasPrice && (
              <div>
                <Label>Price</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. ₹5,000 onwards" />
              </div>
            )}
            <div>
              <Label>{meta.contentLabel}</Label>
              <Textarea required rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
            {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Update" : "Add"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState message={`No ${meta.title.toLowerCase()} entries yet. Your chatbot can only answer from what you add here.`} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{item.title}</div>
                  {item.price && <div className="text-sm text-brand-700 font-medium mt-0.5">{item.price}</div>}
                  <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{item.content}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge tone={item.status === "ACTIVE" ? "green" : "gray"}>{item.status}</Badge>
                  <div className="flex gap-2">
                    <button className="text-xs text-brand-600 font-medium" onClick={() => startEdit(item)}>
                      Edit
                    </button>
                    <button className="text-xs text-red-600 font-medium" onClick={() => remove(item.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
