# Website-Aware Chatbot

A chatbot that answers visitor questions using only a business's own
knowledge articles, uploaded documents, website content, and (optionally)
its own live database/API -- **no AI/LLM involved anywhere**. Every answer
is either stored content returned verbatim, a database value formatted
deterministically, or a fixed "I don't know, call us" fallback. It never
generates, rewrites, or guesses an answer.

Any business can self-register, get an embeddable widget, and manage its
own knowledge base and documents from an admin portal -- the same backend
serves any number of websites, each fully isolated by `websiteId`.

## Quick start

```bash
npm install
npm run build:widget
npm run dev
```

This starts the backend on `http://localhost:4000`.

- **Register a new website**: http://localhost:4000/register/
- **Admin portal** (manage knowledge articles + document uploads): http://localhost:4000/admin/

## How it works end to end

1. **Register** a website at `/register/` (business name, category, phone,
   website URL). This creates a `websiteId`, an admin login, and returns an
   embed snippet plus the widget's install instructions for that framework.
2. **Install** the widget by pasting the returned `<script>` tag into the
   business's site. The widget talks to `/api/chat` (keyword matching) or
   `/api/chat-semantic` (local sentence-embedding matching) depending on
   which one was set up -- both are always available for any website.
3. **Manage content** at `/admin/`: add knowledge articles (title +
   answer), or upload a PDF/DOC/DOCX/TXT document -- its text is extracted,
   chunked, and becomes searchable knowledge automatically. Uploaded
   documents can be viewed or downloaded again from the same screen.
4. **Answer a question**: for every message, the engine tries these
   sources in order and stops at the first real match --
   1. Personal booking status (only for a website's own logged-in
      visitor, or by a real reference code if the site has a live API --
      see below)
   2. General live data (e.g. "do you have rooms available")
   3. The website's own ingested page content
   4. Knowledge base articles (including ones extracted from uploads)
   5. Nothing matched -- a fixed fallback message + "Call Us"

## Two matching engines

- `server/src/lib/retrieval/search.ts` -- keyword/TF-IDF style scoring,
  used by `POST /api/chat`.
- `server/src/lib/embeddings/` + `server/src/lib/retrieval/semanticSearch.ts`
  -- local sentence embeddings (`@huggingface/transformers`, runs fully
  offline, no API key), matched by cosine similarity, used by
  `POST /api/chat-semantic`.

`server/src/engine/answerEngine.ts` and `answerEngineSemantic.ts` are
deliberate near-duplicates that differ in exactly one line (which scorer
they call) -- everything else (booking status, live data, small talk,
fallback behavior) is identical between the two.

## Connecting a website's own real backend (optional)

A website config can set `liveApiUrl` (see
`server/src/config/websites.ts`). When set, the engines call that
business's own backend instead of the local placeholder JSON stores:

- `server/src/integrations/liveHotelApi.ts` is the current adapter --
  booking status is looked up by **reference code** (e.g. `HB-D7VDEZ`),
  never by name, since only the person holding that code should see the
  booking. Room/availability content is pulled live from the business's
  own API instead of scraping its (possibly client-rendered) website.

Websites without a `liveApiUrl` fall back to the local JSON stores under
`server/data/` and a simple login for booking status.

## Website isolation

Every website has its own entry in `server/src/config/websites.ts`
(file-backed, added automatically by `/register/` -- no code changes
needed for a new tenant). Every lookup -- live data, website content,
knowledge base, documents, bookings -- is a function that takes
`websiteId` as its first argument and only ever touches that one
website's data. `answerEngine.ts` / `answerEngineSemantic.ts` resolve
`websiteId` exactly once per request; there is no path through the code
that reads a different website's data while answering a given request.

## Project structure

```
server/
  src/
    config/
      env.ts               config from environment variables
      websites.ts           file-backed per-website registry
    data/
      knowledgeStore.ts      per-website knowledge articles
      documentStore.ts       metadata for uploaded documents
    db/
      liveDataStore.ts       per-website "live" data (placeholder JSON)
      bookingStore.ts         per-website login-gated bookings (placeholder JSON)
    auth/
      customerAuth.ts, adminAuth.ts, session.ts
    content/
      websiteContentIngest.ts   fetches + structures a website's own page content
    lib/
      documents/parse.ts        PDF/DOC/DOCX/TXT text extraction + chunking
      retrieval/search.ts        keyword scorer
      embeddings/, retrieval/semanticSearch.ts   local embedding scorer
    intent/                  small classifiers (booking status, live-data, small talk, reference code)
    integrations/            adapters for a tenant's own real backend
    engine/
      answerEngine.ts             keyword-engine orchestration
      answerEngineSemantic.ts     semantic-engine orchestration
    routes/
      chat.routes.ts, chatSemantic.routes.ts
      register.routes.ts, websiteConfig.routes.ts
      adminAuth.routes.ts, adminKnowledge.routes.ts, adminDocuments.routes.ts
      customerAuth.routes.ts
  public/
    register/    self-service sign-up page
    admin/       knowledge + document management portal
  data/          runtime JSON "database" (gitignored -- created automatically)
widget/
  src/widget.ts   the embeddable chat widget (Shadow DOM, no external deps)
```

## Environment variables (`server/.env`)

```
PORT=4000
NODE_ENV=development
DATABASE_URL=./data/live-data.json   # placeholder "live data" store; a real site can use liveApiUrl instead
```

Per-website business info (name, phone, address, hours) lives in
`server/data/websites.json` (created by `/register/`), not in environment
variables -- a single global `HUMAN_PHONE` wouldn't let different tenants
each have their own number.

## Debug mode

In development (`NODE_ENV=development`, the default), every `/api/chat`
and `/api/chat-semantic` response includes a `debug.sources` object
showing which of Website / Knowledge Base / Database / Human fallback was
actually used to answer. This is omitted entirely when
`NODE_ENV=production`.

## What's intentionally NOT here

No AI/LLM, no lead capture, no billing. `server/data/` is a set of flat
JSON files standing in for a real database -- swappable for one later
without changing the calling code's interface.
