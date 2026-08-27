import { FormEvent, useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { Button, Card, Input, Label, PageHeader, Spinner, Textarea } from "../components/ui";

interface Settings {
  botName: string;
  welcomeMessage: string;
  avatarUrl: string | null;
  primaryColor: string;
  buttonColor: string;
  quickReplies: string[];
  enabled: boolean;
  leadCaptureEnabled: boolean;
  handoffWhatsapp: string | null;
  handoffPhone: string | null;
  handoffEmail: string | null;
  handoffEnquiryUrl: string | null;
}

export function ChatbotSettingsPage() {
  const [form, setForm] = useState<Settings | null>(null);
  const [quickRepliesText, setQuickRepliesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Settings>("/api/chatbot/settings").then((s) => {
      setForm(s);
      setQuickRepliesText(s.quickReplies.join(", "));
    });
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const quickReplies = quickRepliesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
      await api.put("/api/chatbot/settings", { ...form, quickReplies });
      setMessage("Chatbot settings saved.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner />;

  const field = (key: keyof Settings) => ({
    value: (form[key] as string) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  return (
    <div>
      <PageHeader title="Chatbot Settings" subtitle="Customize how your chatbot looks and how visitors reach a human" />
      <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
        <Card className="p-6 space-y-5">
          <div className="font-semibold text-gray-900">Branding</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bot Name</Label>
              <Input required {...field("botName")} />
            </div>
            <div>
              <Label>Bot Avatar URL</Label>
              <Input {...field("avatarUrl")} placeholder="https://example.com/avatar.png" />
            </div>
          </div>
          <div>
            <Label>Welcome Message</Label>
            <Textarea rows={2} required {...field("welcomeMessage")} />
          </div>
          <div>
            <Label>Quick Reply Suggestions (comma separated, up to 6)</Label>
            <Input value={quickRepliesText} onChange={(e) => setQuickRepliesText(e.target.value)} placeholder="Our Services, Pricing, Contact Us" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="h-9 w-12 rounded border border-gray-300" />
                <Input {...field("primaryColor")} />
              </div>
            </div>
            <div>
              <Label>Chat Button Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.buttonColor} onChange={(e) => setForm({ ...form, buttonColor: e.target.value })} className="h-9 w-12 rounded border border-gray-300" />
                <Input {...field("buttonColor")} />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            Chatbot enabled (visitors can see and use it)
          </label>
        </Card>

        <Card className="p-6 space-y-5">
          <div className="font-semibold text-gray-900">Human Handoff</div>
          <p className="text-sm text-gray-500 -mt-3">
            When the chatbot can't confidently answer a question, it offers these options -- never invented, always from what you configure here.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>WhatsApp Number</Label>
              <Input {...field("handoffWhatsapp")} placeholder="+91XXXXXXXXXX" />
            </div>
            <div>
              <Label>Phone Number</Label>
              <Input {...field("handoffPhone")} placeholder="+91XXXXXXXXXX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Support Email</Label>
              <Input type="email" {...field("handoffEmail")} />
            </div>
            <div>
              <Label>Enquiry Form URL</Label>
              <Input {...field("handoffEnquiryUrl")} placeholder="https://example.com/enquiry" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.leadCaptureEnabled} onChange={(e) => setForm({ ...form, leadCaptureEnabled: e.target.checked })} />
            Allow the chatbot to collect visitor leads (name, mobile, email, requirement)
          </label>
        </Card>

        {message && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</div>}
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
