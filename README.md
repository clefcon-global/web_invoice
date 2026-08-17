# Sheer Aura — Invoice & Receipt Generator

Fill a form, download a branded, print-ready PDF invoice or receipt. Customers,
products and document numbers stay in sync across every device.

> **Status: PDF engine complete and verified. Application layer in progress.**
> Build specification: [`docs/SPEC.md`](docs/SPEC.md) ·
> Contributor rules: [`AGENTS.md`](AGENTS.md)

---

## What it does

Pick a customer, add line items from a saved product catalogue, set quantities.
Subtotal, optional delivery charge, optional tax and total calculate themselves.
Click *Issue* and a branded A4 PDF downloads.

- **Real PDFs** — vector text that stays sharp and selectable, not a screenshot.
- **Saved catalogues** — customers and products with default prices.
- **Gapless numbering** — invoice and receipt numbers never collide across devices.
- **Client-side rendering** — invoice contents are generated in the browser and
  never transmitted anywhere.
- **Always warm** — no cold starts, no spin-down, no waiting on first load.

## Progress

| Phase | State |
|---|---|
| 1 · Font selection | ✅ Complete — Prata chosen from three free candidates |
| 2 · PDF engine | ✅ Complete — `pdf-lib`, verified against the reference to 0.01pt |
| 3 · Application (form, catalogues, local storage) | ▶ Next |
| 4 · Cloudflare Worker + D1 sync | ⬜ Pending |
| 5 · Deployment + access control | ⬜ Pending |

The PDF module renders both document types, flows 30+ line items across pages
with repeated headers, and is protected by golden-file regression tests that
have been proven to catch layout drift.

## Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Vite + React on Cloudflare Pages | Static, instant, never sleeps |
| Sync API | Cloudflare Worker | Isolate model — no cold starts |
| Database | Cloudflare D1 (SQLite) | Real transactions for atomic numbering |
| PDF | `pdf-lib` in-browser | Vector text, privacy, zero server cost |

Runs entirely within free tiers. Cloudflare Pages permits commercial use on its
free plan — notably, Vercel's Hobby tier and GitHub Pages do not, which is why
neither is used here.

## Getting started

Requires **Node 20+**. Python 3 with `pdfplumber` and `pypdfium2` is needed to
run the PDF tests.

```bash
npm install
npm test
```

```bash
npm run render:samples
```

Sample output goes to `docs/sheer_aura/samples/` (git-ignored — it contains real
business details).

## Repository layout

```
AGENTS.md                 conventions for contributors and AI agents
docs/SPEC.md              full build specification — start here
assets/fonts/             open-licence fonts (static instances)
src/lib/money.js          integer-cent currency arithmetic
src/pdf/                  🔒 SEALED document renderer — do not edit
scripts/                  sample + golden generation
```

---

## Security notes

**This repository is public. The deployed application is not.** Those are two
independent things:

- **Source code is public** — that is fine. Security comes from secrets being
  absent from the code, never from the code being hidden.
- **The deployed app is access-controlled** at the Cloudflare edge, so people who
  find this repository still cannot reach the running app or any business data.

### Rules for contributors

1. **Never commit secrets.** Worker secrets are set with `wrangler secret put`
   and live in Cloudflare, never in the repository or the deployed bundle.
2. **Never commit real business data.** The reference invoice contains a real
   customer name and bank account number and is git-ignored deliberately. Only
   the logo is tracked. Use fictional data in tests and examples.
3. **Anything in the frontend bundle is public.** Vite inlines `VITE_*` variables
   into the shipped JavaScript. Authentication is verified **server-side in the
   Worker only** — never in the browser.

Git history is permanent. A secret committed and then deleted is still exposed
and must be treated as compromised and rotated.

## Fonts

The original design used **The Seasons**, a paid commercial font that is not
redistributable and is therefore **not** included here. The body serif is
**Prata**; headings use **Josefin Sans**. Both are SIL Open Font License.

Fonts in `assets/fonts/` are pre-built static instances — see
[`AGENTS.md`](AGENTS.md) §6 before touching them.

## Licence

Private commercial project. All rights reserved.
Sheer Aura branding and logo are the property of Sheer Aura.
Bundled fonts remain under the SIL Open Font License.
