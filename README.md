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

`git push` -> GitHub -> Vercel builds and deploys automatically.

- Push to `main` -> production deploy.
- Any other branch or PR -> preview deploy with its own URL.
- `.github/workflows/ci.yml` runs typecheck + lint + build on every push and PR.

## Verifying a check-in actually shipped

`GET /api/health` reports the commit the running deployment was built from:

```bash
curl https://c3check.com/api/health
# {"ok":true,"commit":"<sha>","branch":"main","env":"production","time":"..."}
```

Locally `commit` and `branch` are `"local"`; Vercel injects the real values at build time.
After a push, poll this endpoint until `commit` matches the SHA you pushed.

## Licence

| What | Licence | File |
|---|---|---|
| Source code | Apache-2.0 | `LICENSE` |
| Prose: README, the `/sources`, `/terms` and `/privacy` copy, the interview questions, the rule-trace explanations | CC BY 4.0 | `LICENSE-docs` |
| Quoted legislation and ATIP passages | not ours to license | `COPYRIGHT` |
| **Your own results** | **yours: no attribution, no conditions** | n/a |

Apache-2.0 rather than MIT for three reasons specific to this project: section
4(b) requires a modified file to say it was modified, which suits a tool whose
whole premise is that contested readings stay visible; section 6 withholds the
name, which is the only real protection against a stripped-down fork calling
itself c3check; and sections 7-8 disclaim warranty and limit liability far more
carefully than MIT's single sentence, which matters for software that produces
legal-adjacent output. `/terms` covers people using the hosted site; the licence
covers people taking the code, and those are different populations.

No open source licence can stop someone selling this with the caveats removed;
none restricts commercial use or requires accuracy. What guards against that is
the name, the `NOTICE` file, and `/terms`.

If you fork this and change how a paragraph is read, please say so prominently.
A confident answer on a genuinely unsettled point is the specific failure this
project exists to avoid.

## Storage

No database. Small amounts of state will live as JSON. Note that the Vercel
filesystem is read-only at runtime, so JSON that needs to *change* after deploy
cannot simply be written back to a file in the repo; that decision is still open.
