# c3check

Next.js (App Router) + TypeScript + Tailwind. Deployed on Vercel, source on GitHub.
Target domain: **c3check.com** (not yet configured).

## Local development

```bash
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
```

Node version is pinned in `.nvmrc` (22).

## Deploy pipeline

`git push` → GitHub → Vercel builds and deploys automatically.

- Push to `main` → production deploy.
- Any other branch or PR → preview deploy with its own URL.
- `.github/workflows/ci.yml` runs typecheck + lint + build on every push and PR.

## Verifying a check-in actually shipped

`GET /api/health` reports the commit the running deployment was built from:

```bash
curl https://c3check.com/api/health
# {"ok":true,"commit":"<sha>","branch":"main","env":"production","time":"..."}
```

Locally `commit` and `branch` are `"local"` — Vercel injects the real values at build time.
After a push, poll this endpoint until `commit` matches the SHA you pushed.

## Storage

No database. Small amounts of state will live as JSON. Note that the Vercel
filesystem is read-only at runtime, so JSON that needs to *change* after deploy
cannot simply be written back to a file in the repo — that decision is still open.
