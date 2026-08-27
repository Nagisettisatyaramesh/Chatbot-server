# AI Website Assistant

A multi-tenant SaaS platform: one chatbot codebase, embedded on any number of
websites via a single `widget.js` script, where each embed (`data-client-id`)
is answered strictly from that one business's own knowledge — never mixed
with another tenant's data, and never invented when the knowledge isn't there.

## How tenant isolation actually works

- Every table that holds business data has a `customerId` column.
- The **only** place `clientId` (public, e.g. `PHOTOGRAPHY_001`) is resolved
  to an internal `customerId` is `resolveActiveCustomer()` in
  [server/src/routes/chat.routes.ts](server/src/routes/chat.routes.ts). Every
  downstream call in that request (retrieval, AI prompt, usage, persistence)
  uses that one resolved id.
- Knowledge retrieval ([server/src/lib/retrieval/search.ts](server/src/lib/retrieval/search.ts))
  always issues `WHERE customerId = ...` as its first filter — there is no
  code path that queries knowledge without it.
- Admin API routes never take a `customerId` from the request; they take it
  from the authenticated JWT (`req.auth.customerId`) and every Prisma call is
  scoped to it. Cross-tenant reads/writes return `404`, not `403` — a tenant
  can't even confirm another tenant's record exists.
- Super Admin is the only role that can see more than one tenant, and every
  such access is written to `AuditLog`.
- If retrieval finds nothing confident, or the AI itself reports
  `sufficient: false`, the visitor gets a fixed fallback message and a
  "Talk to Human" option sourced from that tenant's own configured
  WhatsApp/phone/email/enquiry URL — never a guess.

This was manually verified end-to-end during development: same `widget.js`
embedded on two different demo pages, with a hotel bot correctly refusing to
answer a photography question (and vice versa), and a customer admin token
getting `404` when probing another tenant's knowledge item by id. See
`test-sites/` for the two demo pages.

## Project layout

```
server/   Express + TypeScript API, Prisma (PostgreSQL), Claude integration
widget/   The embeddable widget.js (Shadow DOM, esbuild bundle)
admin/    React + Vite + Tailwind admin portal (customer + super admin)
test-sites/  Demo HTML pages used to manually verify isolation
```

## Getting started

Prerequisites: Node.js 18+, a PostgreSQL database (local install, or point
`DATABASE_URL` at a hosted one -- e.g. the one Railway provisions, see
"Deploying" below). For zero-setup local dev without installing Postgres,
you can instead set `provider = "sqlite"` in `prisma/schema.prisma` and use
`DATABASE_URL="file:./dev.db"`.

```bash
npm install
cd server && npx prisma db push && npx prisma db seed && cd ..
npm run build:widget
npm run dev:server    # http://localhost:4000
npm run dev:admin     # http://localhost:5173
```

Seeded logins (from `server/prisma/seed.ts`):

| Role | Email | Password | Notes |
|---|---|---|---|
| Super Admin | superadmin@aiwebsiteassistant.dev | SuperAdmin123! | sees all tenants |
| Business owner (demo) | owner@lumierephoto.test | Password123! | clientId `PHOTOGRAPHY_001` |
| Business owner (demo) | owner@seasidegrand.test | Password123! | clientId `HOTEL_002` |
| Business owner (real) | owner@uniquecreations.test | TempPass123! | clientId `UNIQUE_CREATIONS_001` -- change this password in a real deployment |

To see the widget answering real AI questions (not just the safe fallback),
set `ANTHROPIC_API_KEY` in `server/.env` and restart the server. Without a
key, the chatbot still works correctly — it always falls back to the human
handoff message instead of guessing, which is the required behavior when AI
isn't available.

Demo pages (server must be running): `http://localhost:4000/demo/site-a-photography.html`
and `http://localhost:4000/demo/site-b-hotel.html` — both load the exact
same `widget.js`.

## Embedding on a real site

```html
<script
  src="https://YOUR-DOMAIN.com/widget.js"
  data-client-id="YOUR_CLIENT_ID">
</script>
```

The admin portal's **Install Chatbot** page generates this automatically
per business, plus framework-specific snippets (HTML, WordPress, React,
Next.js, Shopify).

## What's implemented

- Multi-tenant data model with `customerId` isolation on every table
  (customers, chatbot settings, knowledge, documents, website imports,
  conversations, messages, leads, unanswered questions).
- Email/password auth (JWT) with roles `OWNER`, `STAFF`, `SUPER_ADMIN`.
- Knowledge base CRUD (About/Services/FAQs/Policies), document upload
  (PDF/DOC/DOCX/TXT, parsed and chunked into searchable knowledge), and a
  same-origin website crawler that respects `robots.txt` and stages
  everything as `DRAFT` for the customer to approve before it's used.
- Tenant-scoped retrieval (TF-IDF style ranking with type-aware synonym
  boosting — see "Notes on retrieval" below) feeding a Claude tool-call that
  is forced to return `{ answer, sufficient, quick_replies }`, so the model
  can't slip an answer past the confidence gate.
- Two-layer no-hallucination gate: retrieval confidence AND the model's own
  `sufficient` flag both have to pass before an answer is shown; either
  failing triggers the fixed fallback + human handoff, never a guess.
- Human handoff (WhatsApp / call / enquiry form), sourced entirely from
  each business's own settings, never hardcoded.
- Deterministic lead-capture flow (name → mobile → email → requirement),
  independent of the AI so it can't be talked off-script.
- Embeddable widget: Shadow DOM isolation, mobile-responsive, typing
  indicator, quick replies, persistent "Talk to Human" access.
- Customer admin portal: dashboard with real usage/conversation/lead stats,
  business profile, chatbot branding + handoff config, knowledge base
  management, conversations, leads, unanswered-questions-to-FAQ workflow,
  install/embed page.
- Super Admin portal: create/disable customers, change plans/limits,
  cross-tenant conversation/lead lookup (audited), plan configuration.
- Security: rate limiting (chat, auth, admin API), input sanitization,
  prompt-injection defenses (visitor text is never concatenated into the
  system prompt; the model is instructed to treat it strictly as data and
  refuse role/prompt/data-exfiltration requests; answers are forced through
  a structured tool call), file upload type/size restrictions, JWT auth on
  every admin/super-admin route, `helmet`, no API keys ever reach the
  frontend or widget.
- Usage limits per plan (Starter/Business/Premium), enforced before any AI
  call is made, with a rolling 30-day reset.

## Notes on retrieval (an intentional simplification)

Knowledge retrieval uses an in-app TF-IDF-style ranker
([server/src/lib/retrieval/search.ts](server/src/lib/retrieval/search.ts))
rather than vector embeddings. This was a deliberate choice for this build:
it keeps tenant isolation trivially auditable (one Prisma `findMany` with a
`WHERE customerId` clause, no separate vector store to keep in sync or
misconfigure), needs no embeddings API key to run, and is more than
adequate for the size of knowledge base a single business typically has
(dozens to low hundreds of items). For very large knowledge bases, swapping
in embeddings (e.g. Voyage AI + pgvector) behind the same
`retrieveKnowledge()` function would be a contained change — the tenant
isolation guarantee lives in that function's `WHERE` clause, not in the
ranking algorithm.

## Deploying (Railway)

The backend (`server/`, which also serves `widget.js`) is deployed
separately from any business's actual website -- the website only ever
needs the one `<script>` tag from the Install Chatbot page, same as any
third-party chat widget.

1. Push this repo to GitHub (already done: `github.com/<you>/ai-website-assistant`).
2. On [railway.app](https://railway.app), **New Project → Deploy from GitHub repo**,
   select this repo, and set the service's **Root Directory** to `server`.
3. **Add a PostgreSQL plugin** to the project -- Railway sets `DATABASE_URL` automatically.
4. Set these environment variables on the service: `JWT_SECRET` (long random string),
   `ANTHROPIC_API_KEY` (optional), `ADMIN_CORS_ORIGIN` (your deployed admin portal's URL),
   `APP_BASE_URL` (this service's own public URL once assigned).
5. Build command: `npm run build`. Start command: `node dist/index.js`
   (`postinstall` already runs `prisma generate` automatically).
6. One-time setup after the first deploy, via `railway run`:
   `npx prisma db push` then `npx prisma db seed`.
7. Deploy `admin/` separately (Vercel/Netlify work well for a static Vite
   build) with `VITE_API_BASE_URL` set to the Railway service's public URL.

## Further production hardening

- Move file storage (`UPLOAD_DIR`) to S3 or equivalent object storage --
  most PaaS containers (including Railway's default) have an ephemeral
  filesystem, so uploaded documents won't survive a redeploy otherwise.
- Set a strong, unique `JWT_SECRET` (not the local dev default).
- Wire up real billing against the `Plan` model.
