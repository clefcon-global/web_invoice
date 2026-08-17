# Sheer Aura — Invoice & Receipt Generator

Fill a form, download a branded, print-ready PDF invoice or receipt. Customers,
products and document numbers stay in sync across every device.

> **Status: specification complete, not yet implemented.**
> The full build specification lives in [`docs/SPEC.md`](docs/SPEC.md).

---

## What it does

Pick a customer, add line items from a saved product catalogue, set quantities.
Subtotal, optional delivery charge, optional tax and total calculate themselves.
Click *Issue* and a branded A4 PDF downloads.

- **Real PDFs** — vector text that stays sharp and selectable, not a screenshot.
- **Saved catalogues** — customers and products with default prices, add/edit/delete.
- **Gapless numbering** — invoice and receipt numbers never collide across devices.
- **Client-side rendering** — invoice contents are generated in the browser and
  are never transmitted anywhere.
- **Always warm** — no cold starts, no spin-down, no waiting on first load.

## Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Vite + React on Cloudflare Pages | Static, instant, never sleeps |
| Sync API | Cloudflare Worker | Isolate model — no cold starts |
| Database | Cloudflare D1 (SQLite) | Real transactions for atomic numbering |
| PDF | Generated in-browser | Privacy, and zero server cost |

Runs entirely within free tiers. Cloudflare Pages permits commercial use on its
free plan — notably, Vercel's Hobby tier and GitHub Pages do not, which is why
neither is used here.

## Repository layout

```
docs/
  SPEC.md              Full build specification — start here
  sheer_aura/          Brand reference (see note below)
```

Application code is added as the build proceeds; see the build phases in the spec.

## Getting started

Not yet applicable — there is no application code to run. Once phase 3 of
[`docs/SPEC.md`](docs/SPEC.md) lands, this section will carry the install and
dev-server commands.

Requirements will be Node 20+ and npm.

---

## Security notes

**This repository is public. The deployed application is not.** Those are two
independent things, and the distinction matters:

- **Source code is public** — that is fine. Security comes from secrets being
  absent from the code, never from the code being hidden.
- **The deployed app is access-controlled** — restricted at the Cloudflare edge,
  so people who find this repository still cannot reach the running app or any
  business data.

### Rules for contributors

1. **Never commit secrets.** No passphrases, password hashes, API tokens or
   Cloudflare credentials. Worker secrets are set with `wrangler secret put` and
   live in Cloudflare, never in the repository or the deployed bundle.
2. **Never commit real business data.** The reference invoice contains a real
   customer name and bank account number and is git-ignored deliberately. Only the
   logo is tracked. Do not add real invoices, customer lists or exported backups.
3. **Anything in the frontend bundle is public.** Vite inlines `VITE_*` variables
   into the shipped JavaScript, where anyone can read them. Authentication is
   therefore verified **server-side in the Worker only** — never in the browser.

Git history is permanent. A secret committed and then deleted is still exposed and
must be treated as compromised and rotated.

## Fonts

The original design uses **The Seasons**, a paid commercial font that is not
redistributable and is therefore not included here. The build substitutes an
open-licensed serif. **Josefin Sans** (SIL Open Font License) is used as designed.

## Licence

Private commercial project. All rights reserved.
Sheer Aura branding and logo are the property of Sheer Aura.
