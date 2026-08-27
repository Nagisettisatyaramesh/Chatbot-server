import { useEffect, useState } from "react";
import { api, API_BASE_URL } from "../lib/api";
import { Card, PageHeader } from "../components/ui";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable -- user can still select and copy manually
    }
  };
  return (
    <div className="relative">
      <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto"><code>{code}</code></pre>
      <button
        onClick={copy}
        className="absolute top-3 right-3 text-xs bg-white/10 hover:bg-white/20 text-white rounded-md px-2 py-1"
      >
        {copied ? "Copied!" : "Copy Code"}
      </button>
    </div>
  );
}

export function InstallPage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ clientId: string }>("/api/customer").then((c) => setClientId(c.clientId));
  }, []);

  if (!clientId) return null;

  const snippet = `<script\n  src="${API_BASE_URL}/widget.js"\n  data-client-id="${clientId}">\n</script>`;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Install Chatbot" subtitle="Add your chatbot to any website with one script tag" />

      <Card className="p-6 mb-6">
        <div className="font-semibold text-gray-900 mb-1">Your Client ID</div>
        <div className="text-sm text-gray-500 mb-3">This identifies your business to the chatbot backend. Never share it with unrelated parties.</div>
        <div className="inline-block bg-brand-50 text-brand-700 font-mono text-sm rounded-lg px-3 py-1.5">{clientId}</div>
      </Card>

      <Card className="p-6 mb-6">
        <div className="font-semibold text-gray-900 mb-3">Your Chatbot Installation Code</div>
        <CodeBlock code={snippet} />
      </Card>

      <Card className="p-6 space-y-6">
        <div className="font-semibold text-gray-900">Installation Instructions</div>

        <div>
          <div className="font-medium text-sm text-gray-800 mb-2">Plain HTML</div>
          <p className="text-sm text-gray-500 mb-2">Paste the snippet above just before the closing <code>&lt;/body&gt;</code> tag on every page you want the chatbot to appear on.</p>
        </div>

        <div>
          <div className="font-medium text-sm text-gray-800 mb-2">WordPress</div>
          <p className="text-sm text-gray-500 mb-2">
            Go to <em>Appearance → Theme File Editor → footer.php</em> and paste the snippet before <code>&lt;/body&gt;</code>. Alternatively, use a
            "Header/Footer scripts" plugin and paste it into the footer section.
          </p>
        </div>

        <div>
          <div className="font-medium text-sm text-gray-800 mb-2">React</div>
          <CodeBlock
            code={`useEffect(() => {\n  const script = document.createElement("script");\n  script.src = "${API_BASE_URL}/widget.js";\n  script.setAttribute("data-client-id", "${clientId}");\n  document.body.appendChild(script);\n  return () => document.body.removeChild(script);\n}, []);`}
          />
        </div>

        <div>
          <div className="font-medium text-sm text-gray-800 mb-2">Next.js</div>
          <CodeBlock
            code={`import Script from "next/script";\n\n<Script\n  src="${API_BASE_URL}/widget.js"\n  data-client-id="${clientId}"\n  strategy="lazyOnload"\n/>`}
          />
        </div>

        <div>
          <div className="font-medium text-sm text-gray-800 mb-2">Shopify</div>
          <p className="text-sm text-gray-500 mb-2">
            Go to <em>Online Store → Themes → Edit Code → theme.liquid</em> and paste the snippet just before <code>&lt;/body&gt;</code>.
          </p>
        </div>

        <div>
          <div className="font-medium text-sm text-gray-800 mb-2">Other website builders</div>
          <p className="text-sm text-gray-500">
            Most site builders (Wix, Squarespace, Webflow, etc.) have a "Custom Code" or "Embed" section under site settings -- paste the snippet there so it loads on every page.
          </p>
        </div>
      </Card>
    </div>
  );
}
