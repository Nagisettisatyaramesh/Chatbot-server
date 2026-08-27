import { ChangeEvent, useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "../../lib/api";
import { Badge, Button, Card, EmptyState, Spinner } from "../../components/ui";
import { DocumentItem } from "./types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api.get<DocumentItem[]>("/api/documents").then(setDocs).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.upload("/api/documents", formData);
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    await api.delete(`/api/documents/${id}`);
    load();
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="font-medium text-gray-900 mb-1">Upload a document</div>
        <p className="text-sm text-gray-500 mb-3">PDF, DOC, DOCX, or TXT. The text is extracted and added to your knowledge base automatically.</p>
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={onFileChange} disabled={uploading} className="text-sm" />
        {uploading && <p className="text-sm text-gray-400 mt-2">Uploading and processing...</p>}
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{error}</div>}
      </Card>

      {docs.length === 0 ? (
        <EmptyState message="No documents uploaded yet." />
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{doc.filename}</div>
                <div className="text-xs text-gray-400">{formatSize(doc.sizeBytes)} &middot; {new Date(doc.createdAt).toLocaleDateString()}</div>
                {doc.errorMessage && <div className="text-xs text-red-500 mt-1">{doc.errorMessage}</div>}
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={doc.status === "READY" ? "green" : doc.status === "FAILED" ? "red" : "yellow"}>{doc.status}</Badge>
                <button className="text-xs text-red-600 font-medium" onClick={() => remove(doc.id)}>
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
