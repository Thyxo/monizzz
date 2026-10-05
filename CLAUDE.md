# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

monizzz is a personal budget/savings tracker PWA (Next.js 16 App Router, React 19, Prisma, Tailwind 4). The UI and all API error messages are in Danish (`lang="da"`, amounts formatted as `da-DK` with a `kr` suffix) — keep new user-facing strings in Danish.

The project was scaffolded by the Z.ai web-dev template, which explains the leftovers: `.zscripts/`, `Caddyfile`, `mini-services/`, `examples/`, `tests/*.sh`, and many unused dependencies (`next-auth`, `next-intl`, `@tanstack/react-query`, `z-ai-web-dev-sdk`, …).

## Commands

```bash
npm install          # postinstall runs prisma generate
npm run dev          # next dev on :3000, output tee'd to dev.log (needs a POSIX shell for `tee`; on Windows use `npx next dev -p 3000`)
npm run lint         # eslint .
npm run build        # prisma generate + next build + copy static/public into .next/standalone (uses `cp`, POSIX shell)
npm run start        # prisma db push, then node .next/standalone/server.js
npm run db:push      # prisma db push --accept-data-loss
npm run db:migrate   # prisma migrate dev (no migrations directory exists yet; schema is synced with db push)
```

Both `bun.lock` and `package-lock.json` are committed; the `.zscripts` use bun, the package scripts work with npm.

There is no JS test suite. `tests/*.sh` are bash tests for the `.zscripts` deploy helpers only (e.g. `bash tests/database-runtime-build.sh`).

For local development put a Postgres `DATABASE_URL` and a `JWT_SECRET` in `.env.local` (git-ignored), run `npx prisma db push`, and register a user in the app.

### Environment variables

- `DATABASE_URL` — `prisma/schema.prisma` declares `provider = "postgresql"`, but the committed `.env` still holds a SQLite `file:` URL from the template. A Postgres URL must be supplied for Prisma to work.
- `JWT_SECRET` — required in production; a dev-only default is used otherwise (`src/lib/auth.ts`).
- `CRON_SECRET` — required by `/api/cron/run`; without it that endpoint always answers 401.
- `CORS_ORIGIN` — defaults to `*` (`src/proxy.ts`).
- `NEXT_PUBLIC_API_URL` — optional base URL for the client API wrapper, so the frontend can be hosted separately from the API.

## Architecture

### Single-page client app

There is exactly one route, `src/app/page.tsx`, and it is a client component. It gates on auth (`LoginPage` vs. the app shell) and switches between views in `src/components/app/` via `activeTab` in the Zustand store (`src/store/index.ts`) — there is no URL routing. The bottom bar holds Hjem, Transaktioner, Oversigt and Kalender; the last item, "Mere", opens a popup with Konti, Mål, Lommeregner, Kategorier and Indstillinger. Account detail is store state too (`selectedAccountId`).

- **Data:** views read through the react-query hooks in `src/lib/queries.ts` (`useAccounts`, `useCategories`, `useTransactions`, `useMonthTransactions`, …) and write through `useAction`, which invalidates every query afterwards and reports errors as a toast. All HTTP goes through the `api` object in `src/lib/api.ts`, which attaches the bearer token and calls the store's logout on a 401 (no page reload).
- **Statistics are computed in the client** from transaction lists (Hjem trend and month totals, Oversigt per category, Kalender dots). There is no stats endpoint. A transaction with a `transferId` is a transfer and is excluded from income/expense figures (`txKind` in `src/lib/format.ts`).
- **Add/edit transaction** is one global bottom sheet (`TransactionSheet.tsx`) opened with `openSheet(...)` from the store; passing `transaction` puts it in edit mode.
- **Offline (read-only):** the query cache is persisted to `localStorage` and the user is cached in the store, so the app opens with the last fetched data. Writes need a connection; `useOnline()` disables the buttons. The cache is cleared on login and logout. It is also discarded whenever `NEXT_PUBLIC_BUILD_ID` (set per build in `next.config.ts`) changes, so data cached by an older version never reaches newer code; still, read fields the API added recently defensively, because the Vercel frontend and the Railway backend do not deploy at the same instant.
- **Calculator state** lives in `useCalculatorStore` (persisted) so a half-typed calculation survives leaving the tab. It stores numbers with `.`; the comma is display-only.

### Theming and styling

The user's `themeAccentColor` / `themeBgColor` are stored on the `User` row. `applyTheme()` in `src/lib/theme.ts` derives the CSS variables (`--accent`, `--bg`, `--fg`, `--fg-muted`, `--card`, `--border`, `--sheet`, …) and sets them on `<html>`, so portalled sheets and the login page get them too. Views use Tailwind utilities plus the small component classes in `src/app/globals.css` (`.card`, `.field`, `.btn*`, `.label`, `.scroll-area`) and the shared pieces in `src/components/app/ui.tsx` (`Sheet` on vaul, `Segmented`, `Header`, `TransactionRow`, …). Icons are lucide; category icons are keys into `src/lib/icons.tsx`.

Keep custom CSS inside `@layer base` / `@layer components`: unlayered rules override every Tailwind utility (an unlayered `* { padding: 0 }` once disabled all spacing). `src/components/ui/` is the stock shadcn/ui set from the template and is not used by the app.

### API

Route handlers live under `src/app/api/**/route.ts` and are written with the helpers in `src/lib/route.ts`: `authed(label, handler)` verifies the JWT and passes the user, handlers throw `ApiError(status, danskBesked)`, and bodies are parsed with `parseBody(request, schema)` against the zod schemas in `src/lib/validation.ts` (amounts are rounded to 2 decimals there). Every Prisma query must be scoped by `user.userId`. Auth is a custom HS256 JWT (jose, 30-day expiry) sent as `Authorization: Bearer`; `next-auth` is installed but unused. `src/proxy.ts` (Next 16's replacement for `middleware.ts`) only adds CORS headers to `/api/*` — it does not enforce auth. Login and register are rate-limited per process (`src/lib/rate-limit.ts`).

Resource endpoints multiplex verbs on one route with the id in the body (PUT) or `?id=` query (DELETE) rather than using `[id]` segments.

### Data model and money movement

Prisma models: `User` → `Account` → `Transaction`, optional one-to-one `Goal` per account, `Category`, and `AutoTransferRule`. Things that are not obvious from the schema alone:

- `Account.balance` is a denormalized `Float`. All balance changes go through `src/lib/ledger.ts` (`postEntry`, `postTransfer`, `createEntry`, `updateEntry`, `deleteEntry`), which writes the balance and the `Transaction` row in one `db.$transaction`. Editing adjusts the balance by the difference; deleting reverses it.
- A transfer is two `Transaction` rows (negative on source, positive on destination) sharing a `transferId`, with notes suffixed `(udgående)` / `(indgående)`. Editing or deleting either row applies to both.
- The transaction's date is `createdAt`, which is user-editable. There is no separate date column.
- `Account.type` is a free-form string (`standard`, `opsparing`, `monizz`, `donation`, `custom`, `goal_savings`). Only `goal_savings` accounts get a `Goal` row and appear under Mål.
- `Category.kind` is `expense` or `income`; `Transaction.categoryId` is optional (null = "Ukategoriseret") and is set null when a category is deleted.

### Automatic rules

A rule books every `interval` days, weeks or months (`frequency`), starting on `anchorDate`. `src/lib/auto-rules.ts` owns all of the date logic, in Europe/Copenhagen calendar dates:

- `pendingDueDates()` lists the bookings a rule owes: every due date after its last booking (`lastRunAt`), never before `startFrom` and never in the future — so missed ones are caught up, at most 366 per run. Monthly rules on a day the month lacks book on the month's last day.
- Rules created before schedules existed have no `anchorDate`; they are monthly on `dayOfMonth` and book at most once per calendar month. Keep that branch: production still has such rows.
- `runDueRules()` claims each due date with a conditional update of `lastRunAt` before booking it, which makes concurrent runs safe. Source + destination is a transfer, source only is money leaving the system, destination only is money arriving from outside.
- The API exposes the schedule as `frequency`, `interval` and `nextDate` (`yyyy-MM-dd`, computed by `nextDueDate()`). Sending back the `nextDate` a rule already has leaves its schedule untouched; a new one must be today or later and becomes the anchor.

The app calls `POST /api/auto-rules/run` on start and after saving a rule, so no scheduler is required. `POST /api/cron/run` does the same for all users and requires `CRON_SECRET`.

### PWA

`public/sw.js` is a hand-written network-first service worker that caches same-origin GETs (never `/api/`) as the offline fallback for the app shell. Bump `CACHE_NAME` when cached assets need to be invalidated.

## Deployment

Repo: https://github.com/Thyxo/monizzz. Both hosts build the same full Next.js app from `main`; the split is only in which one the browser talks to.

- **Frontend — Vercel** project `monizzz` (team `thyxos-projects`), served at `monizzz.vercel.app`. Its only env var is `NEXT_PUBLIC_API_URL`, which points `src/lib/api.ts` at the Railway backend. It is inlined at build time, so changing it requires a redeploy. Vercel has no `DATABASE_URL`, so its own copy of `/api/*` is not functional.
- **Backend — Railway** project `Monizzz`, service `monizzz` (Railpack build, `npm run build` / `npm run start`, so `prisma db push` runs against production on every deploy) at `monizzz-production.up.railway.app`, plus a `Postgres` service with a volume. Service variables: `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `CORS_ORIGIN`, `HOSTNAME`.
- Because the browser calls the API cross-origin, `src/proxy.ts` (CORS + `OPTIONS` handling) is load-bearing, and auth must stay header-based rather than cookie-based.
- No cron schedule is configured on Railway or Vercel, and none is needed: the app books due rules itself on start.
- Schema changes must be additive (new tables, nullable columns, columns with defaults). Production start runs `prisma db push` without `--accept-data-loss`, so a destructive change aborts the deploy instead of dropping data; never run `npm run db:push` against production.

## Build quirks

- `next.config.ts` sets `output: "standalone"` (the build and start scripts depend on it), `typescript.ignoreBuildErrors: true`, and `reactStrictMode: false`. Type errors do not fail the build; use `npx tsc --noEmit` to check types.
- `eslint.config.mjs` turns off most rules (`no-explicit-any`, `no-unused-vars`, `react-hooks/exhaustive-deps`, …), so a clean lint run says little.
- `.zscripts/build.sh` and `start.sh` hardcode `/home/z/my-project` and target the original Z.ai sandbox (Caddy on :81 in front of Next on :3000); they are not usable as-is elsewhere.
- `.env` is tracked in git even though `.gitignore` lists `.env*`.
