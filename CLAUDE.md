# CLAUDE.md

All project conventions live in **[AGENTS.md](AGENTS.md)** — read it first.

Full build specification: **[docs/SPEC.md](docs/SPEC.md)**.

## The four things that will bite you

1. **`src/pdf/**` is SEALED.** Import `src/pdf/index.js` and call it. Never edit
   the module, never regenerate golden files. A failing golden test means you
   broke the document.
2. **This repo is PUBLIC** and the reference files hold a real customer name and
   a real bank account number. Fictional data only in anything committed.
3. **Auth is server-side only.** Vite inlines `VITE_*` vars into the public
   bundle; a browser-side passphrase check is not security.
4. **Money is integer cents.** Use `src/lib/money.js`.

## Where to start

Phases 1–2 are complete. Begin at **Phase 3** (`docs/SPEC.md` §10): the
Vite + React app around the finished PDF module.
