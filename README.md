# Bitramed

Bitramed is a single Next.js application for learners and administrators. It uses the App Router, Supabase, React Query, Tailwind CSS, and a static export suitable for Cloudflare Workers Assets.

## Development

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000/` for the learner app or `http://localhost:3000/JAK2V617F/` for the owner-only admin panel. Environment defaults use the current Supabase project; copy `apps/web/.env.example` to `apps/web/.env.local` to override them.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

The application source is under `apps/web/src`. Learner routes are grouped in `app/(learner)`, the admin routes are under `app/JAK2V617F`, shared data boundaries are under `lib`, and browser workflows are covered by `tests/web.spec.js`.

## Deployment

```bash
npx wrangler deploy
```

The checked-in `wrangler.jsonc` runs the production build and publishes `apps/web/out`. Next.js exports both learner and admin routes as one immutable artifact; there is no legacy learner bundle or admin copy step.

The browser access gates are user-experience boundaries. Supabase RLS and the admin RPC owner checks remain the authorization boundaries and must stay enabled.
