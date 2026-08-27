import { FormEvent, useEffect, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { Badge, Button, Card, EmptyState, Input, Label, Spinner } from "../../components/ui";
import { KnowledgeItem, WebsiteImportJob } from "./types";

export function WebsiteImportPanel() {
  const [jobs, setJobs] = useState<WebsiteImportJob[]>([]);
  const [draftItems, setDraftItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<WebsiteImportJob[]>("/api/website-import"),
      api.get<KnowledgeItem[]>("/api/knowledge?type=WEBSITE&status=DRAFT"),
    ])
      .then(([j, d]) => {
        setJobs(j);
        setDraftItems(d);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setError(null);
    try {
      await api.post("/api/website-import", { url });
      setUrl("");
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const approve = async (id: string) => {
    await api.put(`/api/knowledge/${id}`, { status: "ACTIVE" });
    load();
  };

  const reject = async (id: string) => {
    await api.delete(`/api/knowledge/${id}`);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="font-medium text-gray-900 mb-1">Import Website Knowledge</div>
        <p className="text-sm text-gray-500 mb-3">
          We'll crawl a few public pages of your website (respecting robots.txt) and pull out useful text. Nothing goes live until you review and approve it below.
        </p>
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="flex-1">
            <Label>Website URL</Label>
            <Input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={importing}>
              {importing ? "Crawling..." : "Import"}
            </Button>
          </div>
        </form>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</div>}
      </Card>

      {jobs.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">Import history</div>
          <div className="space-y-2">
            {jobs.map((job) => (
              <Card key={job.id} className="p-3 flex items-center justify-between text-sm">
                <div className="text-gray-700 truncate">{job.url}</div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-gray-400">{job.pagesFound} pages</span>
                  <Badge tone={job.status === "REVIEW" ? "green" : job.status === "FAILED" ? "red" : "yellow"}>{job.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-semibold text-gray-700 mb-2">Pending review ({draftItems.length})</div>
        {draftItems.length === 0 ? (
          <EmptyState message="Nothing waiting for review. Imported pages will appear here before they become part of your live knowledge base." />
        ) : (
          <div className="space-y-3">
            {draftItems.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="font-medium text-gray-900">{item.title}</div>
                <p className="text-sm text-gray-500 mt-1 line-clamp-4 whitespace-pre-wrap">{item.content.slice(0, 400)}</p>
                <div className="flex gap-2 mt-3">
                  <Button className="!px-3 !py-1.5 text-xs" onClick={() => approve(item.id)}>
                    Approve &amp; Add to Knowledge Base
                  </Button>
                  <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => reject(item.id)}>
                    Discard
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
