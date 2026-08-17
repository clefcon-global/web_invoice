# Sheer Aura — Invoice & Receipt Generator · Build Specification

**Version 3 · 2026-08-17**
**Status: Phases 1–2 COMPLETE and verified. Your work starts at Phase 3.**

---

## 0. STOP — read this before writing any code

You are continuing an existing project, not starting one. The hardest part —
the PDF document itself — is **already built, visually verified, and locked**.

### What already works (do not rebuild)

| Thing | State |
|---|---|
| PDF rendering engine | ✅ Done, `src/pdf/` — sealed, see §7 |
| Exact document layout | ✅ Done, matches the real reference to ~0.01pt |
| Invoice + Receipt | ✅ Both render correctly |
| Multi-page flow (30+ items) | ✅ Verified across 3 pages |
| Money arithmetic | ✅ Done, `src/lib/money.js`, integer cents |
| Golden-file regression tests | ✅ 8 tests passing, proven to catch layout drift |
| Fonts | ✅ Chosen, licensed, committed, correctly instanced |

### What you are building (Phases 3–5)

The **application around** the PDF module: the form, line-item editing, live
totals, customer & product management, local caching, offline behaviour,
export/import, then the Cloudflare Worker + D1 sync layer, then deployment.

### The seven rules

1. **`src/pdf/**` is SEALED.** Never edit it. Import it and call it. See §7.
   Everything about the document's appearance is already correct.
2. **Every decision in §3 is already made.** Do not redesign, do not substitute
   "better" libraries, do not add unrequested features. If something looks wrong,
   say so and stop — do not silently deviate.
3. **Never claim something works without running it.** "The PDF renders" requires
   opening the PDF. "Tests pass" requires running them. If you skipped a check,
   say so.
4. **§9 (Security) is not optional.** This repo is PUBLIC and this is a REAL
   business with real customer data and real bank details. Read §9 twice.
5. **Money is integer cents, always.** See §8.4. Floating-point currency is the
   single most likely way to ship a wrong invoice.
6. **Build in phase order** (§10). Each phase has acceptance criteria you must
   actually verify.
7. **If a required value is genuinely missing here, ask.** Do not invent file
   paths, API signatures, or package versions.

### Reference files

| Path | In git? | Notes |
|---|---|---|
| `docs/sheer_aura/sheer aura invoice.pdf` | ❌ ignored | The original design. **Contains real customer name + bank account.** |
| `docs/sheer_aura/sheer aura invoice.png` | ❌ ignored | Same, as an image |
| `docs/sheer_aura/sheer aura logo.png` | ✅ tracked | Logo — branding only, safe |
| `docs/sheer_aura/samples/` | ❌ ignored | Generated samples with real data |

---

## 1. Product summary

A single-page web app for a small Sri Lankan natural-cosmetics business
(soaps, body butter, deodorant; prices in Rs.).

The operator fills a form: customer, line items chosen from a saved product
catalogue, quantities. Subtotal, optional delivery charge, optional tax and
total compute live. Clicking **Issue** assigns the next document number and
downloads a branded A4 PDF.

Owner profile, customers, products and number counters are stored server-side
so multiple devices stay consistent.

**Two document types:** Invoice and Receipt — identical layout, different
wording, independent number sequences.

---

## 2. Non-negotiable constraints

| # | Constraint | Why |
|---|---|---|
| C1 | Total running cost **$0/month** | Hard user requirement |
| C2 | Must **never sleep / cold start** | Hard user requirement. Rules out Render, Fly.io, Heroku-style container tiers |
| C3 | Hosting must **permit commercial use** on its free tier | Real business. Rules out Vercel Hobby and GitHub Pages |
| C4 | Document numbers **gapless and never duplicated** | May be audited |
| C5 | Invoice contents **never transmitted to any server** | Privacy. PDF is generated client-side |
| C6 | Public repo contains **no secrets, no real customer data** | Repo is public |

---

## 3. Locked decisions

| Topic | Decision |
|---|---|
| Language | **JavaScript (ESM) with JSDoc types** — not TypeScript. `package.json` has `"type": "module"` |
| Frontend | **Vite + React** |
| Hosting | **Cloudflare Pages** |
| Backend | **Cloudflare Worker + D1** (SQLite) |
| PDF engine | **`pdf-lib` + `@pdf-lib/fontkit`**, in-browser — decided and proven in Phase 2 |
| Body serif | **Prata** (SIL OFL) — chosen by owner in Phase 1 |
| Heading sans | **Josefin Sans** (SIL OFL) |
| Totals | Subtotal → delivery *(optional)* → tax *(optional)* → TOTAL |
| Synced data | Owner profile, customers, products, counters |
| Auth | Single shared passphrase, hashed, **verified server-side only** |
| Numbering | Plain integers, consumed only on explicit "Issue" |
| Offline | Draft & preview offline; **issuing requires a connection** |
| Backup | One-click export/import of the whole workspace |
| Test runner | **Vitest** (`npm test`) |

### Rejected — do not reintroduce

- **`html2canvas` / `dom-to-image` + `jsPDF`** — rasterises the page into a
  blurry image with unselectable text. Unacceptable for a financial document.
  **Explicitly forbidden.**
- **Cloudflare KV for counters** — eventually consistent; will hand the same
  number to two devices, violating C4. Must be D1 with a transaction.
- **Pre-reserved number blocks for offline issuing** — creates gaps. Rejected in
  favour of requiring a connection to issue.
- **Vercel Hobby / GitHub Pages** — forbid commercial use on free tiers (C3).
- **TypeScript migration** — not worth churning the working, sealed PDF module.
  JSDoc gives editor type-checking without a build step.

---

## 4. Design specification

Every value below was **measured directly** from the reference PDF with
`pdfplumber` / `PIL`. None is estimated. These are already implemented in
`src/pdf/layout.js` — this section documents *why* those numbers are what they
are, so nobody "tidies" them into rounder ones.

### 4.1 Page geometry

| Property | Value |
|---|---|
| Page size | A4 — **595.5 × 842.25 pt** |
| Background | **`#F5F5EF`**, full bleed |
| Content edges | left **46.95**, right **522.46** |
| Table rules | 1 pt (0.75 drawn), black, x 46.95 → 522.46 |
| Row pitch | **35.09 pt** — mean of (469.73 − 329.38) / 4 |
| First rule | **329.38** (the rule *under* row 1) |
| Logo | **107 × 114 pt** at x **246**, top **19** (centred) |

### 4.2 Typography

The original used **The Seasons** (paid, commercial) + **Josefin Sans** (free).

**The Seasons cannot legally be served from a website without a licence we do
not have.** Phase 1 replaced it with **Prata** (SIL OFL), chosen by the project
owner from three candidates rendered against the real reference invoice
(Cormorant Garamond, Playfair Display, Prata).

Prata ships a single weight. The document's only bold use is the `+` before a
totals row, which falls back to regular — matching how sparingly the original
used TheSeasons-Bd (1 glyph in the entire document).

Sizes in use: serif 11 / 12 / 14 pt; Josefin Sans 12 / 13 / 18 / 20 pt.
Column headers carry **1.205 pt letter-spacing** — derived, not guessed: the
reference `ITEMS` spans 41.72 pt, untracked Josefin SemiBold 12 pt spans
36.90 pt, so tracking = (41.72 − 36.90) / 4 gaps.

**Committed fonts** (`assets/fonts/`):

| File | Use |
|---|---|
| `Prata-Regular.ttf` | Body serif — **the live font** |
| `JosefinSans-Regular.ttf` | Headings, "Thank you!", payment block |
| `JosefinSans-SemiBold.ttf` | "BILLED TO:", column headers |
| `CormorantGaramond-*.ttf`, `PlayfairDisplay-*.ttf` | Phase 1 rejects, kept only so the font comparison can be re-run |

> ⚠️ **Never commit The Seasons.** It is not in this repo and must not be added.

### 4.3 Layout

```
                        [ logo, centred, 107×114pt ]

BILLED TO:                                      Invoice No. N
<customer name>                                 25th March 2025

ITEMS                    PRICE (RS.)     QTY    AMOUNT (RS.)
──────────────────────────────────────────────────────────────
Dish wash block                  380       4         1520.00
──────────────────────────────────────────────────────────────
(one rule under each row)
──────────────────────────────────────────────────────────────
                                                     4320.00   ← unlabelled subtotal
                        Delivery Charges           +  400.00   ← optional
                                Tax (15%)          +  708.00   ← optional
TOTAL                                                4720.00

Thank you!

Payment Information                                  Sheer Aura
<bank lines>                                    <address lines>
                                                        <phone>
```

Rules already implemented:
- **Column alignment:** description left, price right, qty centred, amount right.
- **Unit prices drop `.00`** (`380`), **amounts always show 2dp** (`1520.00`).
  This deliberate asymmetry matches the original.
- **Delivery/tax rows vanish entirely** when unused — with both off the output
  matches the reference exactly.
- **Date format:** `25th March 2025` (ordinal + full month + year).
- **Footer is pinned** to fixed page positions and drawn on the **last page only**.
- **Long descriptions** shrink to a floor of 8 pt, then truncate with `…`, so the
  row grid never breaks.
- **Pagination:** rows flow to new pages with the column header repeated. If the
  totals block would collide with the footer, it moves to a fresh page.

### 4.4 Logo — known limitation

`sheer aura logo.png` is **143 × 153 px** placed at 107 × 114 pt = **96 DPI**.
Print wants 300 DPI (≈446 px). **The owner has accepted this** — fine emailed or
on screen, slightly soft if printed.

Swapping it later requires touching only two places: the `LOGO` constant in
`src/pdf/layout.js` (box position and size) and `drawLogo()` in
`src/pdf/template.js`. The image bytes themselves are passed in via
`assets.logoPng`, so a caller can already supply a different file without any
change to the module. **Do not attempt to upscale the current PNG.**

### 4.5 Receipt variant

Identical layout, with: title `Receipt No. N`; footer heading `Payment Received`
plus `Date:` / `Method:` lines replacing the bank details; its own number sequence.

---

## 5. Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser — Vite + React (Cloudflare Pages)      │
│  • the form                                     │
│  • PDF generated HERE, entirely client-side     │
│  • local cache for offline drafting             │
└───────────────────┬─────────────────────────────┘
                    │  small JSON only:
                    │  profile, customers, products, counters
                    │  (NEVER invoice contents — C5)
                    ▼
┌─────────────────────────────────────────────────┐
│  Cloudflare Worker  ──►  D1 (SQLite)            │
│  • verifies the passphrase                      │
│  • hands out numbers atomically                 │
│  • stores the workspace                         │
└─────────────────────────────────────────────────┘
```

**Why a backend exists at all:** exactly one requirement forces it —
synchronised document numbers across devices. Browser storage is per-device;
two devices each holding "next = 12" would both issue invoice 12. Nothing else
about this app needs a server.

**Why Cloudflare:** it satisfies C1–C3 together. Its isolate architecture has no
cold starts, unlike container tiers that spin down after ~15 min idle.

### Verified free-tier facts

*Delegated — read from official Cloudflare docs by a subagent, not verified
first-hand. Re-confirm before relying on any limit.*

| Item | Value |
|---|---|
| Pages | 500 builds/mo, 20k files, unlimited bandwidth, commercial use **allowed** |
| Workers | 100,000 requests/day |
| **D1** | **5M rows read/day, 100k rows written/day, 5 GB storage** |
| Access (Zero Trust) | Free tier commonly cited at 50 users — the official pricing page returned 403, so treat the exact number as **UNVERIFIED** |
| Access auth methods | One-time PIN by email, Google OAuth, GitHub OAuth, email-domain allowlists |
| Access coverage | Applies to Pages **and** Workers — including routes, custom domains, `workers.dev`, and previews |

Expected real usage: a few dozen Worker requests/day against 100,000.

> ⚠️ **D1 write limit bites faster than it looks:** 100k writes/day ≈ 1/second
> sustained, with no burst allowance. A bulk product import could exhaust it.

---

## 6. Repository structure

This is the **actual** current tree (excluding `node_modules/` and ignored files).

```
/
├── AGENTS.md                   ← conventions for AI agents; read it
├── README.md
├── .gitignore                  ← DO NOT weaken. Protects real customer data
├── .gitattributes              ← binary handling for pdf/png/ttf
├── package.json                ← "type": "module"
├── assets/fonts/               ← committed open-licence fonts (§4.2)
├── docs/
│   ├── SPEC.md                 ← this file
│   └── sheer_aura/             ← reference assets (mostly git-ignored)
├── scripts/
│   ├── render-samples.mjs      ← regenerate review samples
│   ├── generate-goldens.mjs    ← OWNER ONLY (§7.4)
│   ├── owner.local.example.json  ← fictional; committed
│   └── owner.local.json        ← REAL details; git-ignored
└── src/
    ├── lib/money.js            ← integer-cent arithmetic (§8.4)
    └── pdf/                    ← 🔒 SEALED (§7)
        ├── index.js            ← the ONLY file you may import
        ├── contract.js         ← frozen input types
        ├── layout.js           ← measured constants
        ├── template.js         ← drawing logic
        └── __golden__/         ← regression tests + fixtures
```

### You will create (Phases 3–5)

```
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── components/             form, line items, pickers, totals
│   └── data/
│       ├── schema.js           types from §8
│       ├── local.js            offline cache
│       ├── assets.js           loads fonts/logo for the browser
│       └── sync.js             calls the Worker API
└── worker/
    ├── wrangler.toml
    ├── src/index.js
    └── schema.sql
```

### Tooling

- **Node 20+ / npm** (verified present: Node v20.19.5, npm 10.8.2).
- **Python 3 with `pdfplumber` and `pypdfium2`** — used by the golden tests to
  extract text positions, and to rasterise PDFs for visual checking. Already
  installed and working on this machine.
- Install packages with `npm install <pkg>`. **Never hand-write version numbers
  into `package.json` from memory.**

---

## 7. 🔒 The sealed PDF module

### 7.1 The rule

`src/pdf/**` is **owned and frozen**. It was authored and visually verified
against the reference document by the project owner. **Do not modify any file
in it.**

This is not a style preference. The PDF *is* the product — it goes to paying
customers and represents the business. A layout regression is invisible in code
review and embarrassing in a customer's inbox. Everything else in this
repository is replaceable; this module is not.

**Permitted:** import it and call it.
**Forbidden without explicit owner instruction:** editing layout, changing fonts
or sizes, adjusting positions, "tidying" the code, reformatting, swapping the
PDF library, or regenerating the golden files.

### 7.2 The only public entry point

The app calls **one function**. It must never import `template.js`, `layout.js`
or anything else inside `src/pdf/`, and must never build document definitions of
its own. Any layout knowledge outside this folder is a bug.

```js
import { renderDocumentBlob, suggestedFilename } from './pdf/index.js';

const blob = await renderDocumentBlob(input, assets);
// trigger a download using suggestedFilename(input)
```

`index.js` exports exactly:

| Export | Purpose |
|---|---|
| `renderDocument(input, assets, opts?)` | → `Promise<Uint8Array>` |
| `renderDocumentBlob(input, assets)` | → `Promise<Blob>` (browser download) |
| `suggestedFilename(input)` | e.g. `Sheer-Aura-Invoice-0012.pdf` |
| `validateDocumentInput(input)` | throws on malformed input |
| `formatDocumentDate(date)` | `25th March 2025` |

### 7.3 The frozen input contract

`contract.js` defines exactly what the module accepts. To put new information on
the document you must **extend the contract deliberately** — never edit the
layout to work around it. If the contract cannot express what you need, **stop
and ask the owner.**

```js
{
  kind: 'invoice' | 'receipt',
  number: 12,                       // integer
  date: new Date(),                 // Date object
  customer: { name: 'Mrs. A. Perera', lines: ['optional', 'extra lines'] },
  owner: {
    businessName: 'Sheer Aura',
    addressLines: ['line 1', 'line 2'],
    phone: '0771234567',
    paymentLines: ['Bank', 'Holder', 'A/C 123'],
    paymentHeading: 'Payment Information',   // optional
  },
  items: [
    { description: 'Dish wash block', unitPrice: 38000, qty: 4 },  // CENTS
  ],
  deliveryCents: 40000,   // or null to hide the row
  taxPercent: 15,         // or null to hide the row
  paidOn: '25th March 2025',   // receipts only
  paidMethod: 'Bank transfer', // receipts only
}
```

**It takes integer cents, not formatted strings.** All currency and date
formatting happens inside the module so every document formats identically.
`validateDocumentInput` throws a clear error on anything malformed — a bad
document fails loudly rather than silently rendering wrong.

The `assets` argument supplies font/logo bytes, so the module works unchanged in
Node and the browser:

```js
{ serifRegular, serifBold, sansRegular, sansSemiBold, logoPng }  // all Uint8Array
```

For the browser you will write `src/data/assets.js` to load these (Vite's
`?url` / `arrayBuffer()`, or base64). **Self-host them — never fetch fonts from
a CDN**, so drafting works offline and no third-party request happens per load.

### 7.4 Golden-file tests are the enforcement

`src/pdf/__golden__/refs/` holds reference PDFs generated from fixed fictional
fixtures. The suite regenerates and compares extracted **text content and glyph
positions** (tolerance 1.5 pt) — not raw bytes, so it survives incidental
differences but catches anything that visibly moves.

**This has been proven to work.** Deliberately shifting one layout constant by
20 pt during Phase 2 caused the suite to fail and name every displaced element
with its exact delta.

> **A failing golden test means YOU BROKE THE DOCUMENT.** It does *not* mean the
> goldens are stale. **Never** "fix" a failure by running
> `scripts/generate-goldens.mjs`. Only the owner regenerates goldens,
> deliberately, after visually re-verifying against the reference. If you believe
> a golden is genuinely wrong, stop and ask.

### 7.5 What you should build instead

Everything outside `src/pdf/`: the form and validation, line-item add/remove,
live totals, customer and product management, local caching and offline
behaviour, export/import, the Worker API, D1 schema, auth, deployment.

That is the large majority of the work and none of it requires opening the PDF
module.

---

## 8. Data model and API

Server is the source of truth; the browser keeps a local cache for offline reads.

### 8.1 Owner profile
Business name, address lines, phone, payment/bank lines. Single record, editable.

### 8.2 Customers
`id`, `name`, `address`, `contact`, timestamps. Add / edit / delete. Synced.

### 8.3 Products
`id`, `name`, `default_price` (cents), timestamps. Add / edit / delete. Synced.

On an invoice the operator picks a product; name and price populate and **remain
editable on that line** without altering the catalogue entry.

### 8.4 Money — read carefully

**Never use floating point for currency.** `0.1 + 0.2 !== 0.3`; on an invoice
that surfaces as a total one cent off, which is both wrong and embarrassing.

All monetary values are **integers in cents** (rupees × 100). This is already
implemented and unit-tested in `src/lib/money.js` — **use it, don't reimplement**:

| Function | Purpose |
|---|---|
| `parseCents(input)` | `"1,520.50"` → `152050` |
| `lineAmount(unitPrice, qty)` | integer multiply |
| `taxOn(base, percent)` | rounds half away from zero |
| `computeTotals(lines, opts)` | the whole totals block |
| `formatAmount(cents)` | `152000` → `"1520.00"` |
| `formatPrice(cents)` | `38000` → `"380"` |

**Totals order is fixed:** subtotal = Σ(unitPrice × qty); then `+ delivery`;
then tax applied to **(subtotal + delivery)**; then total.

### 8.5 Counters and the Worker API

Two independent sequences: `invoice`, `receipt`.

**The critical operation:** issuing a number must be **atomic**. Two devices
calling simultaneously must get different numbers. Use a **D1 transaction** — a
read-then-write without one has a race condition and will eventually issue
duplicates, violating C4.

Endpoints (all authenticated per §9):

| Endpoint | Purpose |
|---|---|
| authenticate | passphrase → session token |
| fetch workspace | profile, customers, products, counters |
| update profile / customers / products | last-write-wins by timestamp |
| **issue number** | atomically increment and return the next integer |

### 8.6 Offline behaviour

- **Offline:** load from local cache; drafting and previewing work.
- **Issuing requires a connection.** Disable the Issue button and say why.

Rationale: an offline device cannot know whether another device just issued
number 12. Requiring connectivity is what keeps the sequence gapless (C4).

### 8.7 Backup

One-click export of the whole workspace to a local JSON file, plus re-import.
**Not optional.** A free-tier backend is a single point of failure and this is
the user's own data.

---

## 9. Security — mandatory

### 9.1 The core principle

**The repository is public. The deployed app must not be.** These are independent:

- Public **source code** is fine, provided no secrets are in it. Security comes
  from secrets being absent from the code, never from the code being hidden.
- The **deployed app** is restricted separately, at the Cloudflare edge.

Making the repo private would *not* protect the deployed app — the URL would
still be reachable. A public repo does not expose the app, as long as these
rules hold.

### 9.2 Rules

1. **Authentication is verified server-side in the Worker only.**
   Vite inlines every `VITE_*` variable into the shipped JavaScript bundle, where
   anyone can read it with DevTools in seconds. **A passphrase checked in the
   browser is not security — it is decoration.** This is the single most common
   way an app like this gets broken.
2. **Store the passphrase hashed** with a slow KDF (PBKDF2 via Web Crypto, which
   Workers support) and a salt. Never log it.
3. **Secrets live in Cloudflare, not the repo** — `wrangler secret put`. They are
   never in the bundle and never in git.
4. **Protecting the frontend does not protect the API.** The Worker is separately
   addressable and must enforce auth on **every** endpoint independently.
5. **Rate-limit the auth endpoint** so the passphrase cannot be brute-forced.
6. **Git history is permanent.** A secret committed then deleted is still
   exposed — treat it as compromised and rotate it.

### 9.3 Real data must never be committed

The reference invoice contains a **real customer name**, a **real bank account
number and branch**, and the business address and phone. Those values are
deliberately not reproduced in this document — open the local reference file if
you need to see them.

`.gitignore` excludes `docs/sheer_aura/*` (re-including only the logo),
`docs/sheer_aura/samples/`, and `scripts/owner.local.json`.
**Verified** with `git check-ignore`.

Do not weaken this. Do not add real invoices, customer lists or exported
backups. **Use fictional placeholder data in all tests, fixtures and examples**
— `src/pdf/__golden__/fixtures.js` and `scripts/owner.local.example.json` show
the pattern.

> Real owner details for sample rendering live in `scripts/owner.local.json`,
> which is git-ignored. `render-samples.mjs` falls back to the fictional
> `.example` file when it is absent.

### 9.4 Restricting who can load the app

Two layers, **both required**:

- **Layer 1 — Cloudflare Access** in front of the Pages site, so strangers cannot
  even load it. Free tier supports one-time email PINs, Google and GitHub OAuth.
  It also covers Workers routes.
- **Layer 2 — the app passphrase**, enforced in the Worker per §9.2.

Layer 1 alone is insufficient (the Worker is separately reachable if
misconfigured); Layer 2 alone exposes the app surface to the world.

> ⚠️ **Two verified gotchas.** Enabling Access on *preview* URLs via
> `Settings → General` does **not** protect your `*.pages.dev` or custom domain —
> those need a separate Access application under *Zero Trust → Access →
> Applications*. And Pages **preview deployments get their own public URLs**, so
> ensure policy covers them or they become an unprotected back door.

---

## 10. Build phases

### ✅ Phase 1 — Font choice (COMPLETE)
Reference invoice rendered in Cormorant Garamond, Playfair Display and Prata.
Owner chose **Prata**. Recorded in §4.2.

### ✅ Phase 2 — PDF engine (COMPLETE)
`pdf-lib` + `@pdf-lib/fontkit` selected and proven. Verified:
- 442 characters extractable → **real vector text, not an image**
- page size and background exact; right-aligned columns match to **0.01 pt**
- 30 items flow across 3 pages, header repeated, totals + footer on the last
- output ~40 KB (the original hand-made PDF was 74 KB)
- golden tests proven to catch a deliberately introduced 20 pt regression

### ▶ Phase 3 — Static app, local storage only ← **START HERE**
Full form; add/remove line items; live totals; customer and product pickers with
add/edit/delete; working PDF download; export/import. No backend — everything in
browser storage.

**Acceptance:** genuinely usable end to end to issue a real invoice with no
server involved. `npm test` still passes.

### Phase 4 — Worker + D1
Passphrase auth, workspace sync, atomic number issuing.

**Acceptance:** two browsers signed into the same workspace see the same
customers and products; issuing from both **never** produces a duplicate number.
Test this deliberately with concurrent requests.

### Phase 5 — Deploy
Cloudflare Pages + Worker + D1, with §9.4 access control in place.

**Acceptance:** a cold visit after days of no traffic loads immediately; a
signed-out stranger can reach neither the app **nor** the Worker API directly.

---

## 11. Commands

```bash
npm install              # install dependencies
npm test                 # golden-file suite — must pass before you commit
npm run check:secrets    # scan STAGED content for real business data
npm run test:watch       # watch mode
npm run render:samples   # regenerate review samples → docs/sheer_aura/samples/
npm run generate:goldens # ⚠️ OWNER ONLY — see §7.4
```

**Before every commit, run both `npm test` and `npm run check:secrets`.**
The secrets guard derives its patterns from the git-ignored
`scripts/owner.local.json`, so it contains no real values itself, and it masks
every matched value in its output so the check cannot leak in a terminal or CI
log. It exits 1 on a finding. Verified working: a deliberately staged line
containing real details was caught and fully redacted.

Rasterise a PDF to look at it (this is how you *actually* verify a document):

```bash
python -c "import pypdfium2 as p; p.PdfDocument('file.pdf')[0].render(scale=2).to_pil().save('out.png')"
```

---

## 12. Pitfalls already hit — do not repeat these

These cost real debugging time during Phase 2. They are recorded so nobody
rediscovers them.

1. **Text extraction succeeding does NOT mean the PDF renders.**
   An early build extracted all 442 characters and every position matched — yet
   most glyphs were invisible on screen. **Always rasterise and look at the
   image.** Numbers alone are not verification.

2. **Variable fonts embed at the wrong weight, silently.**
   Google's variable TTFs default to their *lightest* named instance — Josefin
   Sans to Thin (100), Cormorant Garamond to Light (300). Embedding one directly
   gives hairline text with no error. All committed fonts are **static instances**
   cut with `fontTools.varLib.instancer`.

3. **Instancing alone can still break glyphs.**
   Cormorant Garamond (~3,241 glyphs) lost most of them after instancing until a
   `fontTools.subset` pass rebuilt the glyph tables. Symptom: `subset: true` and
   `subset: false` produce *different* ink coverage.

4. **Instanced fonts keep stale name-table metadata.**
   They still reported "Cormorant Garamond Light" / "Josefin Sans Thin" after
   instancing. Cosmetic, but it shows up in PDF properties — fixed by rewriting
   name IDs 1, 2, 4, 6, 16, 17.

5. **Baseline-relative vs glyph-top-relative offsets.**
   `pdfplumber`'s `top` is the glyph bounding-box top; `pdf-lib`'s draw `y` is the
   **baseline**. Mixing them double-counted the ascent and dropped the totals
   block 9.5 pt. Offsets in `TOTALS` are baseline-relative — the comments say so.

6. **Comparing right-aligned text by `x0` gives false failures.**
   A substituted font has different glyph widths, so the *left* edge of
   right-aligned text legitimately moves. Compare the **right** edge (`x1`).

7. **A `.example` file with real data in it is still a leak.**
   Named-as-safe files get committed. Fictional data only, always.

---

## 13. Definition of done

- Filling the form and clicking Issue produces a PDF matching §4 with sharp,
  selectable text.
- Line items add/remove freely; subtotal, optional delivery, optional tax and
  total are all correct — verified by unit tests on integer-cent maths.
- Customers and products are selectable from saved lists and fully editable.
- Document numbers never collide or repeat across two devices under concurrent use.
- Both document types generate with independent sequences.
- The site loads instantly on a cold visit after days of inactivity.
- A stranger with the URL can reach neither the app nor the API.
- No secrets and no real customer data anywhere in git history.
- `npm test` passes.
- Total running cost $0/month.

---

## 14. Open risks

| Risk | Status |
|---|---|
| In-browser PDF quality | ✅ **Resolved** — proven in Phase 2 |
| Cloudflare Access free-tier user count | ⚠️ Official pricing page returned 403; the commonly cited 50-user limit is **UNVERIFIED**. Confirm before Phase 5 |
| D1 free-tier limits | Delegated, not first-hand. 100k writes/day has no burst allowance |
| Free-tier terms change | Data is exportable and PDF generation has no server dependency, so the core tool survives losing the backend |
| Logo softness in print | Accepted by owner. Swappable behind one module (§4.4) |
| Prata vs the original serif | Owner-selected from a visual comparison; not an exact match by design |
