# AGENTS.md — read this before doing anything

Conventions for any AI agent or new contributor working in this repo.
Full detail: [`docs/SPEC.md`](docs/SPEC.md). This file is the short version of
the things that will actually bite you.

---

## 1. 🔒 `src/pdf/**` is SEALED — never edit it

The PDF module is finished, visually verified against the real reference
document, and protected by golden-file tests. **It is the product.** It goes to
paying customers.

- ✅ **Do:** `import { renderDocumentBlob } from './pdf/index.js'` and call it.
- ❌ **Don't:** edit layout, change fonts or sizes, adjust positions, "tidy" the
  code, reformat it, swap the PDF library, or regenerate golden files.

`src/pdf/index.js` is the **only** file outside that folder may import. Never
import `template.js` / `layout.js` directly. Any layout knowledge that leaks
outside `src/pdf/` is a bug.

**If a golden test fails, YOU broke the document.** It does *not* mean the
goldens are stale. Never run `npm run generate:goldens` to make a failure go
away — that is owner-only, and only after visual re-verification.

---

## 2. 🔴 This repo is PUBLIC and holds a REAL business's data

The reference invoice contains a real customer's name and a real bank account
number. `.gitignore` protects them. **Never weaken it.**

Before every commit:

```bash
npm run check:secrets
```

That scans staged content for real business data. It derives its patterns from
`scripts/owner.local.json` (git-ignored), so the check itself contains no
secrets — which is exactly why the real values must live in that one file and
nowhere else.

Rules:
- **Fictional data only** in tests, fixtures, examples and sample code.
  See `src/pdf/__golden__/fixtures.js` for the pattern.
- Real owner details go in `scripts/owner.local.json` — **git-ignored**.
- A file named `*.example.*` is committed, so it must contain fictional data too.
- Secrets go in Cloudflare via `wrangler secret put`, never in the repo.
- **Git history is permanent.** A secret committed then deleted is compromised.

---

## 3. 🔴 Auth is server-side only

**Vite inlines every `VITE_*` variable into the shipped JavaScript bundle**,
where anyone reads it with DevTools in seconds.

A passphrase checked in the browser is **decoration, not security**. All
verification happens in the Cloudflare Worker, on every endpoint, independently.
Protecting the frontend does not protect the API.

---

## 4. 🔴 Money is integer cents — always

`0.1 + 0.2 !== 0.3`. On an invoice that ships a total that is wrong by a cent.

Use `src/lib/money.js`. **Do not reimplement currency maths.**

```js
import { computeTotals, formatAmount, parseCents } from './lib/money.js';
```

Totals order is fixed: subtotal → `+ delivery` → `+ tax` (applied to subtotal +
delivery) → total.

---

## 5. Verifying a PDF: LOOK AT IT

**Text extraction succeeding does not mean the PDF renders.** During Phase 2 a
build extracted all 442 characters with every position correct — and was
missing most of its glyphs on screen.

```bash
python -c "import pypdfium2 as p; p.PdfDocument('file.pdf')[0].render(scale=2).to_pil().save('out.png')"
```

Then actually open `out.png`. Numbers are not verification.

---

## 6. Fonts are pre-built — don't re-download them

`assets/fonts/` holds **static instances**, not raw Google downloads.
Raw variable TTFs embed at their lightest instance (Josefin Sans → Thin 100,
Cormorant → Light 300), giving hairline text **with no error**.

Live fonts: **Prata** (body serif) + **Josefin Sans** Regular/SemiBold.
Cormorant and Playfair are kept only so the Phase 1 comparison can be re-run.

**Never add "The Seasons"** — it is a paid commercial font we have no licence for.

---

## 7. Style

- **JavaScript ESM with JSDoc types.** Not TypeScript. `"type": "module"`.
- Match surrounding code: comment density, naming, formatting.
- Smallest correct change. Don't reformat or restructure adjacent code.
- Install deps with `npm install <pkg>` — never hand-write versions from memory.

---

## 8. Commands

```bash
npm install              # dependencies
npm test                 # golden-file suite — must pass before committing
npm run render:samples   # regenerate review samples
```

---

## 9. Honesty requirements

- Never claim something works without running it. "Tests pass" requires running
  them; "the PDF renders" requires looking at it.
- If you skipped a verification step, say so explicitly.
- If a required value is missing, **ask** — never invent file paths, API
  signatures or package versions.
- If something in the spec looks wrong, say so and stop. Don't silently deviate.

---

## 10. Where to start

Phases 1–2 (the PDF module) are **complete**. Your work begins at
**Phase 3** in [`docs/SPEC.md` §10](docs/SPEC.md): the Vite + React app around
the sealed module — form, line items, live totals, customer/product management,
local storage, export/import.

`docs/SPEC.md §12` lists pitfalls already hit and solved. Read it before
debugging anything font- or layout-related.
