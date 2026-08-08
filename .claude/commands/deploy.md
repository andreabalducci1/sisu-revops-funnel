---
description: Ship the funnel to production on Vercel. Guided and confirmed at each external step.
---
# Deploy, ship to production

Deploy the funnel to Vercel.

## How this project actually deploys

Direct from the local working tree with the Vercel CLI, not through GitHub. There is a
known two-account wall on this project (the Vercel account and the GitHub repo owner
differ), which makes the git-connected flow fail with `repo_no_access`. The CLI path
sidesteps it:

```
npx vercel --prod --yes
```

Live production: https://check.sisurevops.com (project `sisu-revops-funnel`).

## Workflow (confirm BEFORE each external action)

1. **Typecheck and build**: run `npx tsc --noEmit`, then `npm run build`. Fix failures
   before deploying.
2. **Check env parity**: every key the code reads must exist in Vercel production
   (`npx vercel env ls production`). Note that `vercel env pull` returns EMPTY values for
   Encrypted vars, so never use it to verify a secret's content. Verify by behavior instead.
3. **Deploy**: `npx vercel --prod --yes`. Confirm before running.
4. **Smoke test production**, do not assume:
   - Landing returns 200 and shows no demo banner.
   - `POST /api/lead` creates an Airtable record.
   - `POST /api/analyze` returns a real report, and a second call returns `cached: true`.
   - Check runtime logs for `[analyze] report email failed`.
5. Update `memory/funnel/config.md` if any URL or ID changed.

## Rules
- **Confirm every irreversible action.**
- Never commit `.env` (it is gitignored).
- `NEXT_PUBLIC_SITE_URL` must point at the production URL, since the report email links
  back to `/book` through it.
- Remove any temporary diagnostic endpoint before finishing, and delete its secret.
