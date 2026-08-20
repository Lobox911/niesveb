# NIESV Ebonyi State Branch — MCPD Portal

Next.js 16 (App Router) · TypeScript · Tailwind. Builds clean, deploys to Vercel as-is.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # verify before pushing
```

## Design system

Seven colours, defined once in `src/app/globals.css` as RGB channel triplets and
mapped in `tailwind.config.ts`:

| Token | Value | Use |
|---|---|---|
| `ink` | `#101E2E` | headings, footer bed |
| `green` | `#0B6E4F` | primary actions, active states |
| `gold` | `#B08A2E` | credential accent — sparing |
| `paper` | `#F7F8F6` | page background |
| `line` | `#DDE2DD` | borders, rules |
| `muted` | `#5C6660` | secondary text |
| `danger` | `#BA1A1A` | errors only |

`colors` **replaces** Tailwind's defaults rather than extending them, so
`bg-gray-100` is a build error rather than a silent eighth colour. This project
grew three competing palettes before that was locked down — leave it replaced.

Shadows are neutralised to `none` in config. Depth comes from a 1px `line` border
on white over paper.

Type: Fraunces (display), Inter Tight (body), IBM Plex Mono (every machine-issued
value — passcodes, amounts, dates, account numbers, serials).

## Signature element

`<CredentialStrip />` — gold left rule, mono code, dashed metadata rows, notched
bottom edge. One implementation in `src/components/`, consumed by success,
retrieve, photo-card, join and certificate. It previously existed as five
divergent copies. Do not fork it.

## Content

All event content lives in `src/lib/event.ts`. The footer, home, category picker
and programme read from it. The branch runs 2027 by editing that one file.

⚠️ **Every value marked `TODO` is unconfirmed placeholder data.** The fee schedule
in particular is unresolved — two incompatible schedules and two different pricing
models appeared across the design batches. See the block comment in `event.ts`.
Do not deploy publicly until the branch confirms.

## Routes

| Route | State |
|---|---|
| `/` | Complete — all nine sections, Event JSON-LD, semantic fee and advert tables |
| `/register` | Complete — explicit category list, live summary |
| `/register/details` | Complete — grouped fields, inline validation, error summary |
| `/register/success` | Complete UI, mock passcode |
| `/retrieve` | Complete UI, mock lookup |
| `/photo-card` | Gate only — upload, crop and card preview still to build |
| `/join` | `before` state only — `open`/`live`/`after` still to build |
| `/certificate` | Gate only — eligibility states and PDF still to build |
| `/programme` | Complete, renders empty until `event.programme` is filled |
| `/verify/[serial]` | Complete UI, mock lookup |
| `/not-found` | Complete |

## Not built yet

Backend work, in dependency order:

1. **Database + schema** (Neon/Postgres): registrations, payments, attendance, certificates
2. **`POST /api/registrations`** — issue passcode, send email + SMS
3. **Passcode verification** — replace the mock gates
4. **Admin** (`/admin`) — payment confirmation drawer, attendance desk with QR scan, event config form, CSV export. Auth required, no public signup route.
5. **Photo card** — crop tool, PNG at 300dpi, PDF at CR80 with 3mm bleed, QR to `/verify/[serial]`
6. **Certificate** — server-side PDF at print resolution with embedded fonts
7. **Join online** — real state machine off the event start time

## Before launch

- [ ] Confirm fee schedule, category count, virtual pricing model
- [ ] Confirm bank account number digit by digit with the branch treasurer
- [ ] Real logo replacing the `EB` placeholder mark in `Header.tsx`
- [ ] Contact phones, email, WhatsApp number in `event.ts`
- [ ] Venue full address (required for the Event JSON-LD)
- [ ] Open Graph image at 1200x630
- [ ] Tab through every page and confirm the green focus ring
