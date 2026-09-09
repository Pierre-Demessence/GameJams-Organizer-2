# Plan: Eliminate first-visit skeletons via Cache Components (PPR)

## Goal

Remove the full-page `loading.tsx` skeleton shown on the **first** visit to dynamic
routes, so navigation shows an instant static shell with data streaming into it.
(Revisit smoothness is already solved by the `staleTimes` router cache.)

## Key finding

In Next 16, PPR was merged into the **`cacheComponents`** experimental flag. It is
**global, not per-page** — there is no `experimental_ppr` per-route opt-in anymore.
Enabling it changes rendering semantics for the entire app:

- `export const dynamic = "force-dynamic"` is forbidden (build error).
- Any "unstable" value read during prerender (`new Date()`, uncached `fetch`,
  `auth()`, `params`, `searchParams`, DB reads) **must** be inside a `<Suspense>`
  boundary or a `'use cache'` function, otherwise the build fails.

## Blast radius (verified against current build)

- **Root layout blocker:** `src/components/footer.tsx` calls `new Date().getFullYear()`
  → currently fails prerender for **every** route (including `/_not-found`). Must be
  fixed first.
- **`export const dynamic` to remove:** `src/app/page.tsx`, `src/app/api/health/route.ts`.
- **16 page routes** to audit; those reading DB/`auth()`/`params`/`searchParams` need a
  `<Suspense>` boundary around the dynamic part:
  - Instant-shell candidates (biggest UX win): `/`, `/jams`, `/jams/[slug]`,
    `/users/[username]`, `/submissions/[id]`.
  - Auth-gated pages (mostly forms; lower priority): `/settings`, `/admin`,
    `/jams/new`, `/jams/[slug]/edit|manage|results|submissions/new`,
    `/submissions/[id]/edit|rate`.
  - Already static (no change): `/sign-in`, `/sign-up`.
- `computeJamStatus()` defaults to `new Date()` — its callers must render inside the
  dynamic boundary.

## Approach

- [ ] Enable `cacheComponents: true` in `next.config.ts` (keep `staleTimes`).
- [ ] Fix `Footer` `new Date()` (render year in a tiny client component or a stable
      build-time constant) so the shared shell prerenders.
- [ ] Remove `force-dynamic` from `src/app/page.tsx` and `src/app/api/health/route.ts`.
- [ ] Home `/`: extract the three jam sections into an async child and wrap in
      `<Suspense>` using the existing home skeleton as fallback.
- [ ] `/jams`: keep the header + filter form in the static shell; wrap the results
      list (searchParams + DB) in `<Suspense>` with the jams skeleton fallback.
- [ ] `/jams/[slug]`, `/users/[username]`, `/submissions/[id]`: wrap DB reads in
      `<Suspense>`; keep the frame static.
- [ ] Audit the remaining auth-gated routes so the build passes (wrap dynamic parts;
      these can keep near-full skeletons since they are gated anyway).
- [ ] Verify `pnpm build` succeeds with **no build-time DB access** (all DB stays
      inside Suspense/dynamic) so the Docker `builder` stage keeps working.
- [ ] Re-measure click→content on the browse pages; confirm no first-visit skeleton.
- [ ] Peer review; then move this plan to `docs/plans/done/`.

## Risks / tradeoffs

- **Experimental flag** — `cacheComponents` semantics can change between Next releases.
- **App-wide** — every page must comply or the production build breaks; higher
  regression surface than the surgical fixes already shipped.
- **Docker build** — must ensure no static shell touches the DB at build time.

## Smaller alternative (if the above is too much)

Refactor only the browse/list/detail pages to **client-side data fetching** (SWR/
React Query) against the existing `/api/*` REST routes. Contained, no global
experimental flag, and gives the classic SPA feel (instant shell + ~50ms fetch +
client cache). Larger code change per page but lower framework risk.
