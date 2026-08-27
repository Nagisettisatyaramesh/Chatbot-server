import { useState } from "react";
import { PageHeader } from "../components/ui";
import { KnowledgeTypeSection } from "./knowledge/KnowledgeTypeSection";
import { DocumentsPanel } from "./knowledge/DocumentsPanel";
import { WebsiteImportPanel } from "./knowledge/WebsiteImportPanel";

const TABS = [
  { key: "ABOUT", label: "About Business" },
  { key: "SERVICE", label: "Services" },
  { key: "FAQ", label: "FAQs" },
  { key: "POLICY", label: "Policies" },
  { key: "DOCUMENTS", label: "Documents" },
  { key: "WEBSITE", label: "Import Website" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function KnowledgeBasePage() {
  const [tab, setTab] = useState<TabKey>("ABOUT");

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        subtitle="Everything here is the ONLY source of truth your chatbot uses to answer visitors. If it's not here, the bot won't invent it."
      />
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "ABOUT" && <KnowledgeTypeSection type="ABOUT" />}
      {tab === "SERVICE" && <KnowledgeTypeSection type="SERVICE" />}
      {tab === "FAQ" && <KnowledgeTypeSection type="FAQ" />}
      {tab === "POLICY" && <KnowledgeTypeSection type="POLICY" />}
      {tab === "DOCUMENTS" && <DocumentsPanel />}
      {tab === "WEBSITE" && <WebsiteImportPanel />}
    </div>
  );
}
