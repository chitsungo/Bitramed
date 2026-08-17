# Bitramed

Bitramed combines the existing learner-facing static application with a new, separately built Next.js admin control room. The admin source lives in `apps/admin` and is exported into `public/admin` during the root build so the existing Cloudflare static-asset deployment continues to serve one site.

## Admin development

Requirements: Node.js 20 or newer and npm.

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Optionally copy `apps/admin/.env.example` to `apps/admin/.env.local` and set the existing Supabase public URL and anonymous key. Repository defaults point to the current Bitramed project so existing browser sessions keep working.

3. Start the learner app and Next.js admin together:

   ```bash
   npm run dev:admin
   ```

4. Open `http://localhost:3000/admin/`. Unauthenticated users are returned to the learner sign-in flow; only owner or allowlisted accounts pass the `is_current_user_admin` gate.

Useful checks:

```bash
npm run typecheck
npm run lint:admin
npm run test:admin
npm run build
```

`npm run build` first builds the legacy learner assets, then statically exports Next.js with the `/admin` base path and publishes the output to `public/admin`. Do not edit generated files in `public/admin`; change `apps/admin` instead.

## Admin structure

- `apps/admin/src/app` — App Router pages for overview, learners, access, analytics and activity.
- `apps/admin/src/components` — shared shell, owner gate, shadcn-style UI primitives, dialogs and states.
- `apps/admin/src/lib/admin-api.ts` — typed Supabase RPC boundary and runtime response validation.
- `apps/admin/src/lib/metrics.ts` — combined normal-quiz and past-paper selectors.
- `apps/admin/src/types` — admin data contracts.
- `supabase/migrations` — versioned RPC permission and ownership hardening.

The browser gate is a UX boundary only. Database functions must retain their internal owner check and must not grant execution to `anon` or `public`; the hardening migration enforces both.
