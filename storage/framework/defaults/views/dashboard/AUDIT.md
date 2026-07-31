# Dashboard audit

Last refreshed: 2026-07-31

This is the current verification record for `./buddy dev --dashboard`. It
replaces the May 2026 migration inventory, whose per-file counts no longer
described the componentized dashboard.

## Current inventory

| Surface | Count |
|---|---:|
| Dashboard STX view files | 120 |
| Dashboard STX components | 283 |
| Dashboard Actions | 359 |
| Registered `/api/dashboard/*` routes | 283 |
| Framework model files | 69 |
| Framework models declaring `useApi` | 60 |
| Direct `fetch()` calls in dashboard views, components, functions, and stores | 0 |

The nine models without `useApi` are internal records or relationship-owned
records: order idempotency keys, order items, errors, jobs, failed jobs, and
payment-provider records. They are not missing generic CRUD surfaces.

## Verified contracts

### Rendering and navigation

- `./buddy dev --dashboard` starts on port 3002 and renders with STX 0.2.144
  and Crosswind 0.2.14.
- 108 static route views render with HTTP 200.
- Full-page and STX fragment requests render for every static route.
- STX prewarms the dependency-aware rendered shell cache with four workers.
  A warm eight-worker crawl measured 4.4 ms p50 and 25.6 ms p95 for full
  pages, plus 6.2 ms p50 and 11.3 ms p95 for navigation fragments.
- Editing a watched route invalidates its rendered cache immediately; editing
  a dashboard composable invalidates the associated client bundle.
- The componentized catch-all renders the native not-found page with HTTP 404
  for both full-page and STX fragment requests.
- 130 distinct rendered local links and assets resolve without a 404 or 5xx.
- Rendered pages contain no unresolved PascalCase component tags.
- Rendered pages contain no duplicate emitted IDs or broken
  `aria-labelledby` references.
- The live render and navigation audit covers all 108 static destinations,
  all 69 discovered model destinations, and the remaining eight parameterized
  route families without a full-page or STX fragment failure.
- Headless desktop and narrow-viewport visual checks cover the componentized
  Terms of Service and Privacy Policy routes linked from registration.
- The fixed desktop sidebar keeps its existing style and content-width
  contract. Dialogs and drawers use `dashboard-modal-layer`.

### STX and componentization

- All 118 non-layout route views are thin component mounts. Stateful
  implementations live under `resources/components/Dashboard/`, including
  guest authentication, legal documents, and not-found pages.
- Project components under `resources/components/` resolve alongside the
  explicit framework dashboard component directory.
- Dashboard templates do not use `window.*`, `document.*`, or page-local DOM
  event wiring.
- Dashboard views, components, composables, and stores use `dashboardApi()`
  instead of direct `fetch()`.
- Shared STX runtime, router, generated Crosswind CSS, pooled component
  factories, scoped styles, and fragment scripts are deduplicated.
- STX dev-server preflight supports GET, HEAD, POST, PUT, PATCH, DELETE, and
  the Authorization and CSRF headers used by the dashboard and Craft.

### Actions, models, and security

- Every registered dashboard route resolves to an Action source file.
- Every dashboard Action declares method metadata matching its route.
- More than 150 direct client calls are checked against route method and path.
- Generic model writes follow the model's declared `useApi` capabilities.
- Aggregate and operational endpoints use dashboard-scoped Actions.
- Unsafe router Actions receive default-on CSRF validation.
- The direct development config editor calls the same canonical CSRF
  validator before a write.
- Password reset uses the registered `POST /password/forgot` route through
  `dashboardApi()` with `auth: false`, while retaining CSRF protection.
- Sensitive dashboard reads and writes use the dashboard guard boundary.

### Action controls

- `Dashboard/UI/Button.stx` is the only generic dashboard action component.
- Its primary variant is the Deployment `Deploy` gradient:
  `bg-gradient-to-b from-blue-500 to-blue-600`.
- The Deployment gradient appears nowhere else in dashboard source.
- Primary, secondary, outline, ghost, danger, success, and warning actions
  share sizing, focus, loading, disabled, link, and toggle behavior.
- Remaining native buttons are semantic state controls, table or card
  selectors, window controls, menu triggers, sort headers, or modal backdrops.

### Data integrity

- The 128 live GET dashboard API routes return JSON or their documented text
  payload with no hidden HTTP-200 error body.
- A fresh live crawl returned 117 successful responses and 11 intentional
  validation, authentication, or missing-resource responses, with no 5xx,
  method mismatch, transport failure, or HTML fallback.
- Generic model routes reject malformed slugs with HTTP 400 before deriving
  an ORM model or SQLite table name.
- Seeded image factories use stable Picsum sources instead of retired
  placeholder hosts. The repair migration preserves non-placeholder URLs.
- `buddy make:migration` generates executable, dialect-aware SQL migrations,
  matching the migration runner's discovery contract.
- Dashboard pages do not substitute mock, sample, random, or placeholder rows
  when an endpoint fails.
- Commerce, content, delivery, marketing, CI, deployments, models, mail,
  infrastructure, and settings surfaces use persisted or inspected source
  data.
- Deployment mutations reject missing confirmation and invalid environments
  before starting a process.

## Reproducible checks

```bash
./buddy dev --dashboard
bun storage/framework/defaults/ai/skills/stacks-dashboard/scripts/audit.ts
# Or target a non-default origin:
bun storage/framework/defaults/ai/skills/stacks-dashboard/scripts/audit.ts --base-url http://127.0.0.1:3002
bun test tests/unit/dashboard-*.test.ts
bun test storage/framework/core/actions/tests/dev-csrf.test.ts
bun run typecheck
bun run typecheck:app
bunx --bun pickier .
```

The focused contracts cover buttons, native STX bindings, route and Action
method alignment, model reads and writes, commerce mutations, deployment
guards, navigation source, sidebar behavior, toasts, and skill documentation.
The 2026-07-31 focused run completed 156 tests with 2,916 assertions and no
failures, followed by both TypeScript checks and a clean repository lint.

## Remaining verification boundaries

These are environment boundaries, not known source defects:

- Destructive success-path testing for every mutation needs a disposable
  database and storage fixture. The current project database is not modified
  merely to prove delete and update controls.
- Provider success paths for AWS, GitHub Actions, Stripe, mail delivery, DNS,
  and cloud resources require configured external credentials and isolated
  test resources. Disabled and error states are rendered and tested locally.
- Craft desktop window behavior requires the native desktop runtime. The web
  dashboard uses the same STX views, component library, API client, and
  sidebar-aware content contract.
- Production deployment behavior belongs to the build and deploy verification
  workflow. This audit covers the dashboard development server requested by
  `./buddy dev --dashboard`.

When one of these environments is available, add an automated fixture-backed
test or provider sandbox contract. Do not add a fake success response or
page-local workaround.
