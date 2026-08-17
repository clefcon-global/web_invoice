# Sheer Aura — Invoice & Receipt Generator · Build Specification

**Version 2 · 2026-08-17 · Status: approved, not yet implemented.**

---

## 0. How to use this document

You are implementing this from scratch. This document is the single source of
truth. Read all of it before writing code.

**Rules for the implementer:**

1. **Every decision in section 3 is already made.** Do not redesign, do not
   substitute "better" libraries, do not add features. If something seems wrong,
   say so and stop — do not silently deviate.
2. **Build in the phase order in section 10.** Each phase has acceptance criteria.
   Do not start a phase until the previous one passes its criteria.
3. **Never claim something works without running it.** "The PDF renders" requires
   opening the PDF. "It builds" requires running the build.
4. **Section 9 (Security) is not optional.** Violating it exposes a real business's
   customer data and bank details. Read it twice.
5. **`src/pdf/**` is sealed — never modify it.** It is authored and visually
   verified by the project owner, and protected by golden-file tests. Import it
   and call it. See **section 7A**, which overrides any instinct to "improve" it.
6. If a required value is genuinely missing from this document, ask rather than
   invent one. Do not guess file paths, API signatures or package versions.

**Reference files** (git-ignored, present locally, see section 9.3):
- `docs/sheer_aura/sheer aura invoice.pdf` — the design to match
- `docs/sheer_aura/sheer aura invoice.png` — same, as an image
- `docs/sheer_aura/sheer aura logo.png` — the logo asset (tracked in git)

---

## 1. Product summary

A single-page web app for a small Sri Lankan natural-cosmetics business.

The operator fills a form: customer, line items (from a saved product catalogue),
quantities. Subtotal, optional delivery charge, optional tax and total compute
live. Clicking **Issue** assigns the next document number and downloads a branded
A4 PDF.

Business details, customers, products and number counters are stored server-side
so multiple devices stay consistent.

**Two document types:** Invoice and Receipt. Identical layout, different wording,
independent number sequences.

---

## 2. Non-negotiable constraints

| # | Constraint | Why |
|---|---|---|
| C1 | Total running cost **$0/month** | Hard user requirement |
| C2 | Must **never sleep / cold start** | Hard user requirement. Rules out Render, Fly.io, Heroku-style container tiers |
| C3 | Hosting must **permit commercial use** on its free tier | This is a real business. Rules out Vercel Hobby and GitHub Pages |
| C4 | Invoice numbers must be **gapless and never duplicated** | May be audited |
| C5 | Invoice contents must **not be transmitted to any server** | Privacy |
| C6 | The public GitHub repo must contain **no secrets and no real customer data** | Repo is public |

---

## 3. Decisions already made — do not revisit

| Topic | Decision |
|---|---|
| Frontend | Vite + React |
| Hosting | Cloudflare Pages |
| Backend | Cloudflare Worker + D1 (SQLite) |
| PDF generation | In-browser, vector text. See section 7 |
| Body font | Free serif substitute — chosen in Phase 1 |
| Heading font | Josefin Sans (SIL OFL, free) |
| Totals | Subtotal → delivery *(optional)* → tax *(optional)* → TOTAL |
| Synced data | Owner profile, customers, products, counters |
| Auth | Single shared passphrase, hashed, verified server-side |
| Numbering | Plain integers. Consumed only on explicit "Issue" |
| Offline | Draft & preview offline; **issuing requires a connection** |
| Backup | One-click export/import of the whole workspace |

**Rejected alternatives — do not reintroduce:**

- `html2canvas` + `jsPDF` — produces a blurry raster image with unselectable text.
  Unacceptable for a financial document. **Explicitly forbidden.**
- Cloudflare KV for counters — eventually consistent, will hand the same number to
  two devices. Must be D1.
- Pre-reserved number blocks for offline issuing — creates gaps. Rejected in favour
  of requiring a connection to issue.
- Vercel / GitHub Pages — forbid commercial use on free tiers (see C3).

---

## 4. Design specification

All values below were **measured directly** from the reference PDF using
pdfplumber and PIL. They are not estimates. Use them exactly.

### 4.1 Page geometry

| Property | Value |
|---|---|
| Page size | A4 — **595.5 × 842.25 pt** (210 × 297 mm) |
| Background | **`#F5F5EF`**, full bleed |
| Table rule extents | x = **47 → 522 pt** (475 pt wide) |
| Table rule weight | **1 pt**, black |
| Row pitch | **35 pt** |
| Logo box | **107 × 114 pt**, at x = **246**, top = **19** (horizontally centred) |

Derived: left content edge x=47, right content edge x=522.

### 4.2 Typography

Original fonts and the sizes they appear at:

| Original font | Weights | Sizes (pt) | Role |
|---|---|---|---|
| The Seasons | Regular, Bold | 11, 12, 14 | Body text, table content, TOTAL |
| Josefin Sans | Regular, SemiBold | 12, 13, 18, 20 | Headings, "Thank you!", labels |

**The Seasons is a paid commercial font.** It is not installed, not in the repo,
and cannot legally be served from a website without a licence we do not have.
It is replaced by a free serif chosen in Phase 1.

**Josefin Sans is free** (SIL Open Font License) and is used as designed.

Table column headers (`ITEMS`, `PRICE (RS.)`, `QTY`, `AMOUNT (RS.)`) are set in
Josefin Sans with visible **letter-spacing** — match this.

> Text colour was not measured. Rules are pure black. Assume black `#000000` for
> text and verify visually against the reference in Phase 1.

### 4.3 Layout

```
                        [ logo, centred, 107×114pt ]


BILLED TO:                                      Invoice No. N
<customer name>                                 <date, e.g. 25th March 2025>


ITEMS                    PRICE (RS.)     QTY    AMOUNT (RS.)
──────────────────────────────────────────────────────────────
<description>                    380       4         1520.00
──────────────────────────────────────────────────────────────
<description>                    250       2          500.00
──────────────────────────────────────────────────────────────
                                                     <subtotal>
                        Delivery Charges           +<delivery>   (optional)
                                     Tax                +<tax>   (optional)
TOTAL                                                   <total>

Thank you!


Payment Information                                  Sheer Aura
<bank name, branch>                             <address line 1>
<account holder>                                <address line 2>
A/C <account number>                                    <phone>
```

Notes:
- One horizontal rule sits **under** each line-item row.
- The subtotal row is **unlabelled** in the original.
- Delivery and tax rows are **hidden entirely** when not used. With both off, the
  output must match the reference exactly.
- Amounts render to **2 decimal places**. Unit prices in the reference show no
  decimals (`380`) while amounts do (`1520.00`) — preserve this distinction.
- Date format is long-form with ordinal: `25th March 2025`.

### 4.4 Logo

Supplied file: `docs/sheer_aura/sheer aura logo.png`, **143 × 153 px, RGB, no
alpha channel**. Placed at 107 × 114 pt, which is **96 DPI**.

This is below the 300 DPI wanted for print (≈446 px would be needed). **The user
has accepted this** — acceptable emailed or on screen, slightly soft if printed.

Isolate the logo behind a single module so a higher-resolution or vector file can
replace it later without touching other code. Do not attempt to upscale it.

### 4.5 Receipt variant

Identical layout, with:
- Title/label reading **RECEIPT** rather than Invoice
- "Paid" wording
- Payment **date and method** replacing the bank payment instructions
- Its own independent number sequence

---

## 5. Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser — Vite + React (Cloudflare Pages)      │
│  • the form                                     │
│  • PDF generated HERE, entirely client-side     │
│  • local cache for offline drafting            │
└───────────────────┬─────────────────────────────┘
                    │  small JSON only:
                    │  profile, customers, products, counters
                    │  (never invoice contents — see C5)
                    ▼
┌─────────────────────────────────────────────────┐
│  Cloudflare Worker  ──►  D1 (SQLite)            │
│  • verifies the passphrase                      │
│  • hands out numbers atomically                 │
│  • stores the workspace                         │
└─────────────────────────────────────────────────┘
```

**Why a backend exists at all:** exactly one requirement forces it — synchronised
invoice numbers across devices. Browser storage is per-device; two devices each
holding "next = 12" would both issue invoice 12. A shared counter needs shared
state. Nothing else about the app requires a server.

**Why Cloudflare:** it satisfies C1–C3 together. Its isolate architecture has no
cold starts, unlike container-based free tiers that spin down after ~15 minutes
idle and take ~30 s to wake.

*Delegated finding — official pricing pages read by a subagent, not verified
first-hand. Re-confirm before relying on limits:*

| Service | Free tier | Sleeps? | Card? | Commercial? |
|---|---|---|---|---|
| Cloudflare Pages | 500 builds/mo, 20k files, unlimited bandwidth | No | No | **Yes** |
| Cloudflare Workers | 100k req/day | No | No | Unverified |
| Vercel Hobby | — | No | No | **No — personal only** |
| GitHub Pages | — | Unverified | Unverified | **No — forbids commercial** |

Expected real usage is a few dozen Worker requests per day against a 100,000/day
allowance.

---

## 6. Repository structure

Create this structure. Do not invent a different one.

```
/
├── README.md
├── .gitignore                  already exists — do not weaken it
├── package.json
├── vite.config.ts
├── index.html
├── docs/
│   ├── SPEC.md                 this file
│   └── sheer_aura/             reference assets (mostly git-ignored)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/             form, line items, pickers, totals
│   ├── pdf/
│   │   ├── template.ts         document definition — the design in section 4
│   │   ├── fonts.ts            font registration
│   │   └── logo.ts             the single logo module (section 4.4)
│   ├── data/
│   │   ├── schema.ts           types from section 8
│   │   ├── local.ts            offline cache
│   │   └── sync.ts             calls the Worker API
│   └── lib/
│       └── money.ts            all currency maths — see section 8.4
└── worker/
    ├── wrangler.toml
    ├── src/index.ts            the API in section 8.5
    └── schema.sql              D1 tables
```

### Tooling

- **Node 20+ and npm** (verified present: Node v20.19.5, npm 10.8.2).
- **TypeScript** throughout, frontend and Worker.
- Install dependencies with `npm install <pkg>` and let npm pin the current
  version. **Do not hand-write version numbers from memory into `package.json`.**

---

## 7. PDF generation — the highest-risk area

### 7.1 Requirements

The output PDF **must**:
- contain **real vector text** — selectable, searchable, sharp at any zoom
- reproduce section 4 accurately
- support a **variable number of line items**, flowing onto page 2+ correctly
- embed the chosen serif and Josefin Sans
- embed the logo
- be small (target well under 500 KB for a typical invoice)

**Forbidden:** any approach that rasterises the DOM to an image
(`html2canvas`, `dom-to-image` + `jsPDF`). It produces blurry, unselectable text.

### 7.2 Library choice — decide in Phase 2, do not assume

Two viable candidates. **Neither has been validated yet.** Phase 2 exists to
choose between them with evidence.

**Option A — `pdfmake`.** Declarative document definitions; automatic table page
breaking. Custom fonts require building a base64 virtual file system (vfs), which
is the main friction.

**Option B — `@react-pdf/renderer`.** React components render to a real vector
PDF; fonts register from a URL or file. Fits the React stack naturally. Verify its
table page-breaking behaviour with long content.

**Decision procedure:** build the same 30-line-item invoice in whichever you try
first. If it meets every criterion in 7.1, use it and record the choice here. If
it fails on any, try the other. **Do not proceed to Phase 3 until one passes.**

### 7.3 Fonts

Josefin Sans and the chosen serif must be **self-hosted**, not loaded from Google's
CDN — the PDF must generate offline for drafting, and a CDN font is a third-party
request on every load. Download the `.ttf`/`.woff2` files into the repo.

Both are open-licensed, so committing them is fine. **Never commit The Seasons.**

---

## 7A. Module ownership — READ BEFORE TOUCHING `src/pdf/`

### 7A.1 The PDF module is sealed

`src/pdf/**` is **owned and frozen**. It was authored and visually verified against
the reference document by the project owner. **Do not modify any file in it.**

This is not a style preference. The PDF is the product — it goes to paying
customers, it represents the business, and a layout regression is both invisible in
code review and embarrassing in the customer's inbox. Everything else in this
repository is replaceable; this module is not.

**Permitted:** import it and call it.
**Forbidden without explicit instruction from the owner:** editing the layout,
changing fonts or sizes, adjusting positions, "tidying" the code, reformatting it,
upgrading or swapping the PDF library, or regenerating the golden files.

### 7A.2 The only public entry point

```
src/pdf/
├── index.ts        ← the ONLY file the rest of the app may import
├── contract.ts     ← frozen input types
├── template.ts     ← layout. Do not edit.
├── fonts.ts        ← font registration. Do not edit.
├── logo.ts         ← the swappable logo module (section 4.4)
└── __golden__/     ← reference PDFs + fixtures. Do not regenerate.
```

The application calls exactly one function: data in, PDF blob out. It must never
import `template.ts`, `fonts.ts` or anything else inside `src/pdf/` directly, and
must never construct document definitions of its own.

Any layout knowledge that leaks outside this folder is a bug.

### 7A.3 The input contract is frozen

`contract.ts` defines precisely what the module accepts. To pass new information to
the document you must **extend the contract deliberately** — never work around it
by editing the layout. If the contract cannot express what you need, stop and ask
the owner. Do not improvise.

The contract takes money as **integer cents** (section 8.4). It does not accept
pre-formatted strings; all currency and date formatting happens inside the module,
so that every document formats identically.

### 7A.4 Golden-file tests are the enforcement

`src/pdf/__golden__/` holds fixed sample inputs and the reference PDFs they must
produce. The test suite regenerates and compares extracted text and character
positions against those references.

**If you change the layout, these tests fail and name what moved.** That is their
entire purpose.

A failing golden test means **you broke the document** — fix your change. It does
**not** mean the golden files are stale. Never "fix" a failing golden test by
regenerating the reference files. Only the owner regenerates goldens, deliberately,
after visually re-verifying against the reference document.

### 7A.5 What you should build instead

Everything outside `src/pdf/`: the form and its validation, line-item add/remove,
live totals, customer and product management, local caching and offline behaviour,
export/import, the Worker API, D1 schema, authentication, and deployment.

That is the large majority of the work, and none of it requires opening the PDF
module.

---

## 8. Data model and API

### 8.1 Owner profile

Business name, address lines, phone, and payment/bank details. Single record.
Editable in the UI. Synced.

### 8.2 Customers

`id`, `name`, `address`, `contact`, timestamps. Add / edit / delete. Synced.

### 8.3 Products

`id`, `name`, `default_price`, timestamps. Add / edit / delete. Synced.

On an invoice the operator picks a product; name and price populate and **remain
editable on that line** without altering the catalogue entry.

### 8.4 Money — read this carefully

**Never use floating-point arithmetic for currency.** `0.1 + 0.2 !== 0.3` will
produce wrong totals on invoices.

Store and compute all monetary values as **integers in cents** (i.e. rupee × 100).
Convert to a display string only at render time. All such logic lives in
`src/lib/money.ts` and must be unit tested.

Totals order: `subtotal` = Σ(unit_price × qty); then `+ delivery` if enabled;
then `+ tax` if enabled (tax is a percentage applied per section 3); then `total`.

### 8.5 Counters and the Worker API

Two independent integer sequences: `invoice`, `receipt`.

**The critical operation:** issuing a number must be atomic. Two devices calling
simultaneously must receive different numbers. Use a **D1 transaction** — a
read-then-write without a transaction has a race condition and will eventually
issue duplicates, violating C4.

Endpoints (all require authentication per section 9):
- authenticate with the passphrase, return a session token
- fetch the whole workspace (profile, customers, products, counters)
- update profile / customers / products
- **issue a number** — atomically increments and returns the next integer

Conflict handling for edits: last-write-wins by timestamp. Adequate for a single
operator; revisit only if concurrent editing becomes real.

### 8.6 Offline behaviour

- **Offline:** the app loads from local cache; drafting and previewing work.
- **Issuing requires a connection.** If offline, disable Issue and say why clearly.

Rationale: an offline device cannot know whether another device just issued number
12. Requiring connectivity is what keeps the sequence gapless (C4).

### 8.7 Backup

One-click export of the entire workspace to a local JSON file, and re-import.
**Not optional.** A free-tier backend is a single point of failure and the customer
and product lists are the user's own data.

---

## 9. Security — mandatory

### 9.1 The core principle

**The repository is public. The deployed app must not be.** These are independent:

- Public **source code** is fine, provided no secrets are in it. Security comes
  from secrets being absent from the code, never from the code being hidden.
- The **deployed app** is restricted separately, at the Cloudflare edge.

Making the repo private would *not* protect the deployed app — the URL would still
be reachable by anyone. Conversely, a public repo does not expose the app, as long
as these rules hold.

### 9.2 Rules

1. **Authentication is verified server-side in the Worker only.**
   Vite inlines every `VITE_*` variable into the shipped JavaScript bundle, where
   anyone can read it with DevTools. **A passphrase checked in the browser is not
   security — it is decoration.** This is the single most common way an app like
   this gets broken.
2. **Store the passphrase hashed**, never in plain text — use a slow KDF (PBKDF2
   via Web Crypto, available in Workers) with a salt. Never log it.
3. **Secrets live in Cloudflare, not the repo.** Set them with
   `wrangler secret put`. They are never in the bundle and never in git.
4. **Protecting the frontend does not protect the API.** An access policy on the
   Pages site does nothing for the Worker, which is separately addressable. The
   Worker must enforce authentication on **every** endpoint, independently.
5. **Rate-limit the authentication endpoint** so the passphrase cannot be
   brute-forced.
6. **Git history is permanent.** A secret committed and later deleted is still
   exposed — treat it as compromised and rotate it.

### 9.3 Real data must never be committed

The reference invoice contains a **real customer name**, a **real bank account
number and branch**, and the business address and phone. Those values are
deliberately not reproduced in this document — open the local reference file if
you need to see them.

`.gitignore` excludes `docs/sheer_aura/*` while re-including only the logo.
**Verified** this works — `git check-ignore` confirms the PDF and PNG are ignored.

Do not weaken this. Do not add real invoices, customer lists or exported backups.
Use invented placeholder data in tests and examples.

### 9.4 Restricting who can load the app

Two layers, both needed:

- **Layer 1 — edge access control.** Put an access policy in front of the Pages
  site so strangers cannot even load it. Exact free-tier mechanism and user limits
  to be confirmed against official Cloudflare docs before Phase 5.
- **Layer 2 — the app passphrase**, enforced in the Worker per 9.2.

Layer 1 alone is insufficient because the Worker is separately reachable. Layer 2
alone is insufficient because it exposes the app surface to the world. Do both.

Also confirm before Phase 5: **Pages preview deployments** get their own public
URLs. Ensure the access policy covers them, or they become an unprotected back door.

---

## 10. Build phases

Each phase ends in something independently checkable. Do not skip ahead.

**Who does what.** Phases 1 and 2 produce the sealed PDF module (section 7A) and
are done by the project owner. Phases 3–5 are the application around it and are
the work handed to other models or sessions. If you are picking this up cold,
**your work starts at Phase 3**, and `src/pdf/` already exists and already works —
call it, do not rebuild it.

### Phase 1 — Font comparison
Render the reference invoice's text in **Cormorant Garamond**, **Prata** and
**Playfair Display**, side by side against the original.
**Acceptance:** the user has seen the comparison and chosen one. Record the choice
in section 4.2. *A visual decision is made visually, not from font names.*

### Phase 2 — PDF proof of concept
Throwaway. Generate an invoice with **30 line items** using a candidate from 7.2.
**Acceptance — open the PDF and confirm all of:**
- text is selectable and sharp when zoomed (not an image)
- the table flows onto page 2 correctly, with headers handled sensibly
- both fonts and the logo embed correctly
- file size is reasonable
- background, rules and column positions match section 4.1

**If any criterion fails, switch library and repeat.** Do not build on an unproven
renderer.

### Phase 3 — Static app, local storage only
Full form; add/remove line items; live totals; customer and product pickers with
add/edit/delete; working PDF download; export/import. No backend — everything in
browser storage.
**Acceptance:** the app is genuinely usable end to end for issuing a real invoice,
with no server involved. Money maths unit tests pass.

### Phase 4 — Worker + D1
Passphrase auth, workspace sync, atomic number issuing.
**Acceptance:** two browsers signed into the same workspace see the same customers
and products; issuing from both **never** produces a duplicate number. Test this
deliberately with concurrent requests.

### Phase 5 — Deploy
Cloudflare Pages + Worker + D1, with section 9.4 access control in place.
**Acceptance:** a genuine cold visit after days of no traffic loads immediately;
a signed-out stranger cannot load the app **or** call the Worker API directly.

Phases 1–3 deliver a fully working tool. Phase 4 adds multi-device sync.

---

## 11. Definition of done

- Filling the form and clicking Issue produces a PDF matching section 4, with
  sharp selectable text.
- Line items add and remove freely; subtotal, optional delivery, optional tax and
  total are all correct — verified by unit tests on integer-cent maths.
- Customers and products are selectable from saved lists and fully editable.
- Invoice numbers never collide or repeat across two devices under concurrent use.
- Both document types (invoice, receipt) generate with independent sequences.
- The site loads instantly on a cold visit after days of inactivity.
- A stranger with the URL can reach neither the app nor the API.
- No secrets and no real customer data exist anywhere in git history.
- Total running cost is $0/month.

---

## 12. Open risks

| Risk | Status / handling |
|---|---|
| In-browser PDF quality | **Unproven.** Phase 2 exists solely to prove it before anything is built on top |
| D1 free-tier limits | Not yet confirmed first-hand. Verify before Phase 4 |
| Cloudflare Access free-tier specifics | Being verified. Confirm before Phase 5 |
| Free-tier terms change | Data is exportable; PDF generation has no server dependency, so the core tool survives losing the backend |
| Logo softness in print | Accepted by user. Swappable behind one module (4.4) |
| Serif font not an exact match | Mitigated by the Phase 1 visual comparison |
