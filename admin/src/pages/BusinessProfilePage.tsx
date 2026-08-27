import { FormEvent, useEffect, useState } from "react";
import { api, ApiRequestError } from "../lib/api";
import { Button, Card, Input, Label, PageHeader, Spinner, Textarea } from "../components/ui";

interface Customer {
  businessName: string;
  description: string | null;
  websiteUrl: string | null;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  businessHours: string | null;
  logoUrl: string | null;
}

const emptyForm: Customer = {
  businessName: "",
  description: "",
  websiteUrl: "",
  category: "",
  address: "",
  phone: "",
  email: "",
  whatsapp: "",
  businessHours: "",
  logoUrl: "",
};

export function BusinessProfilePage() {
  const [form, setForm] = useState<Customer>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Customer>("/api/customer").then((c) => setForm({ ...emptyForm, ...c })).finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await api.put("/api/customer", form);
      setMessage("Business profile saved.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof Customer) => ({
    value: form[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
  });

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Business Profile" subtitle="This information helps your chatbot represent your business accurately" />
      <Card className="p-6 max-w-3xl">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <Label>Business Name</Label>
            <Input required {...field("businessName")} />
          </div>
          <div>
            <Label>Business Description</Label>
            <Textarea rows={3} {...field("description")} placeholder="A short summary of what your business does" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Website URL</Label>
              <Input {...field("websiteUrl")} placeholder="https://example.com" />
            </div>
            <div>
              <Label>Business Category</Label>
              <Input {...field("category")} placeholder="e.g. Photography, Hotel" />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Input {...field("address")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input {...field("phone")} />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input {...field("whatsapp")} placeholder="+91XXXXXXXXXX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Email</Label>
              <Input type="email" {...field("email")} />
            </div>
            <div>
              <Label>Business Hours</Label>
              <Input {...field("businessHours")} placeholder="Mon-Sat 10am-7pm" />
            </div>
          </div>
          <div>
            <Label>Logo URL</Label>
            <Input {...field("logoUrl")} placeholder="https://example.com/logo.png" />
          </div>

          {message && <div className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</div>}
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
