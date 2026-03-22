# CLAUDE.md

## Project Overview

AppTracker is a full-stack co-op/internship application tracker for students. It tracks job applications with status workflows and includes Gmail integration for email-based application detection via LLM classification (user-confirmed, not automatic).

## Tech Stack

- **Framework:** Next.js 14+ (App Router) with TypeScript
- **Database:** PostgreSQL (Supabase) via Prisma v7 ORM + `PrismaPg` adapter
- **Auth:** NextAuth v5 — Google OAuth + Credentials, JWT strategy
- **UI:** Tailwind CSS + shadcn/ui v4 built on `@base-ui/react` (NOT radix-ui)
- **Email:** Gmail API via `googleapis` SDK
- **LLM:** OpenAI GPT-4o-mini for email classification
- **Deployment:** Vercel

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router — pages, layouts, `api/auth/` route |
| `src/app/dashboard/` | Dashboard page (server component) + protected layout |
| `src/app/auth/` | Sign-in / sign-up pages |
| `src/components/dashboard/` | Client components for dashboard UI |
| `src/components/ui/` | shadcn/ui primitives (base-ui backed) |
| `src/lib/actions/` | Server Actions — all mutations live here |
| `src/lib/` | Prisma client, NextAuth config, Zod schemas, utilities |
| `src/generated/prisma/` | Auto-generated Prisma client — do not edit |
| `prisma/` | `schema.prisma` + migrations |

## Essential Commands

```bash
npm run dev                              # Dev server (Turbopack)
npm run build                            # Production build
npx tsc --noEmit                         # Type check
npx prisma generate                      # Regenerate client after schema changes
npx prisma migrate dev --name <name>     # Create and apply migration
```

## Critical Non-Obvious Facts

- Prisma v7 requires `PrismaPg` adapter — see `src/lib/prisma.ts`
- Import Prisma types from `@/generated/prisma/client` (not `@/generated/prisma`)
- shadcn/ui v4 uses `render` prop for trigger composition, not `asChild`
- Zod v4 validation errors are at `.issues`, not `.errors`
- `Select.onValueChange` signature: `(value: string | null, eventDetails) => void`
- No API routes for data — everything goes through Server Actions

## Database Models

`User` · `Application` · `EmailSuggestion` · `ActivityLog` · NextAuth tables (`Account`, `Session`, `VerificationToken`)

See `prisma/schema.prisma` for full schema. Application statuses: `APPLIED → OA → INTERVIEW → FINAL_ROUND → OFFER/REJECTED/WITHDRAWN`.

## Environment Variables

See `.env.example` — required: `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`.

## Additional Documentation

Check these when working in the relevant area:

| File | When to read |
|------|-------------|
| `.claude/docs/architectural_patterns.md` | Before adding mutations, new components, or modifying data flow |
