---
name: stacks-dashboard
description: Use when building or customizing the Stacks admin dashboard, including dashboard pages, model management views, analytics widgets, commerce dashboards, content management, settings panels, deployment monitoring, job/queue management, or the 399 built-in dashboard components. Covers the dashboard system at storage/framework/defaults/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Dashboard

The Stacks admin dashboard provides a full-featured admin panel with 100+ route views, 399 components, and a multi-section layout.

## Key Paths
- Dashboard components: `storage/framework/defaults/resources/components/Dashboard/`
- Dashboard route views: `storage/framework/defaults/views/dashboard/`
- Dashboard layouts: `storage/framework/defaults/views/dashboard/layouts/`
- Dashboard actions: `storage/framework/defaults/app/Actions/Dashboard/`
- Dashboard page endpoints: `storage/framework/defaults/routes/dashboard-api.ts`
- Dashboard navigation registry: `storage/framework/defaults/resources/functions/dashboard/sidebar.ts`
- Configuration: `config/ui.ts`

## Dashboard Sections

Dashboard route views are mounted at the dashboard server root. Do not prefix
page links with `/dashboard`. The `/api/dashboard/*` prefix is reserved for
dashboard data Actions.

### Analytics and Monitoring
- `/` - main dashboard overview
- `/analytics` - analytics hub and chart navigation
- `/analytics/web`, `/analytics/pages`, `/analytics/referrers` - HTTP analytics
- `/analytics/countries`, `/analytics/devices`, `/analytics/browsers` - audience breakdowns
- `/analytics/events`, `/analytics/blog`, `/analytics/marketing` - domain analytics
- `/requests` - captured HTTP request metrics
- `/errors`, `/monitoring/errors` - error tracking and analysis
- `/jobs`, `/jobs/history` - background job monitoring
- `/queue` - queue management and metrics
- `/queries`, `/queries/slow`, `/queries/history` - query analysis

### Commerce
- `/commerce/dashboard` - commerce overview
- `/commerce/pos` - point of sale
- `/commerce/products` - product management
- `/commerce/orders` - order management and processing
- `/commerce/customers` - customer profiles and history
- `/commerce/payments` - payment tracking
- `/commerce/coupons` - coupon and promotion management
- `/commerce/gift-cards` - gift card management
- `/commerce/categories`, `/commerce/manufacturers`, `/commerce/units` - catalog metadata
- `/commerce/variants`, `/commerce/reviews`, `/commerce/taxes` - catalog operations
- `/commerce/waitlist/products`, `/commerce/waitlist/restaurant` - waitlists
- `/commerce/delivery` and `/commerce/delivery/*` - delivery, shipping, driver, and license management

### Content Management
- `/content/dashboard` - content overview
- `/content/posts` - blog post CRUD
- `/content/pages` - page management
- `/content/authors` - author profiles
- `/content/categories` - content categorization
- `/content/tags` - tag management
- `/content/comments` - comment moderation
- `/content/files`, `/content/blog`, `/content/seo` - files, blog operations, and SEO

### The file manager's two layers (stacksjs/stacks#2577)

Worth knowing before adding anything to it, because the split is not obvious
from the endpoints:

- **Storage operations** map to a `StorageAdapter` method and go straight to the
  disk: list, upload, create folder, rename, visibility, duplicate, delete.
- **Metadata** - favourites and tags - has nowhere to live on a disk (extended
  attributes do not survive a copy; S3 object metadata is set at write time, so
  starring a 2 GB video would rewrite 2 GB). It lives in `storage_items`, keyed
  by `(disk, path)`, written by `PUT /files/favorite` and `PUT /files/tags`.

**The disk is authoritative and the table is advisory.** The listing comes from
the disk and rows are joined onto it, so a path with no row is a file with
nothing recorded - which is most files. Renames and deletes made THROUGH the
dashboard reconcile eagerly (a folder is a prefix update, because moving a
folder moves everything under it); a completed listing sweeps rows for paths it
did not see, which is free because the walk already enumerated them. A TRUNCATED
listing sweeps nothing - it has not proved a path is absent.

A file renamed outside the dashboard loses its metadata, and that is by design:
a rename and a copy-then-delete are the same two events to a bucket listing, so
reconciling would be guessing.

### The media pipeline (stacksjs/stacks#2578)

None of the three things an upload might need can happen inside the request: a
transcode is minutes, a vision call is a round trip to a third party. So an
upload dispatches and the dashboard shows state.

- `storage_item_tasks`, one row per `(disk, path, kind)`, kind being
  `optimize` (images, via `ts-images`), `transcode` (video, via `ts-videos`) or
  `tag` (a vision model). They succeed and fail independently, which is why this
  is not a column on `storage_items` - a video whose transcode finished and
  whose tagging failed is a normal state.
- `dispatchDashboardFileTasks` decides from the CONTENT TYPE what a file needs.
  Most uploads are documents and get nothing. A transcode waits for a video
  profile, because the ladder is derived from the source dimensions.
- A dispatch failure is RECORDED, not thrown: a queue that is down leaves a
  visible failure rather than an upload that fails or a file that is silently
  never processed.
- `runTask` owns the queued -> running -> done/failed transitions so the three
  jobs cannot disagree about them. It rethrows after recording, because the row
  and the queue answer different questions - the queue decides whether to retry,
  the row is what somebody looking at the file sees.
- `POST /files/reprocess` re-runs everything, or the kinds you name.

Derivatives are written back to the same disk under `.variants/<path>/`. The
leading dot keeps them out of the listing, which skips hidden components - a
folder of thirty derivatives beside every photo makes the browser useless.

### Remote commands (stacksjs/stacks#960)

Running a configured operation on a configured host over SSH. Deliberately NOT
a terminal: the request names a host KEY and a command KEY, both from
`config/remote.ts`, so there is nothing to escape and no shell to reach. An
interactive session is tracked separately - `Bun.spawn` has no PTY, and
`ssh -tt` gives a remote one but cannot propagate a window resize.

Four things make it safe to expose, and each is a rule to keep:

- **Host keys are verified.** `StrictHostKeyChecking=yes` against the host's
  declared `knownHosts`. Do NOT reuse `sshExec` from `@stacksjs/ts-cloud` for
  anything long-lived: it disables host key checking on purpose, for boxes a
  minute old whose keys cannot be known.
- **Hosts and commands come from config, never the request.** A `RemoteCommand`
  carries an `argv` ARRAY that is never interpolated.
- **The routes do NOT use `guard()`.** That helper drops auth entirely under
  `APP_ENV=local|development|test`, which here would be an unauthenticated
  command runner on any dev machine on the network. They use
  `authenticatedGuard`, and `remote-routes.test.ts` asserts it.
- **Authorization fails CLOSED.** The `run-remote-command` gate receives the
  host and command keys; with no gate defined, every run is refused. This is the
  opposite of the websocket authenticator in `@stacksjs/realtime`, which
  proceeds when none is installed.

Runs are recorded before AND after - a run recorded only on completion loses the
command that hung and the one whose process died with the box. The audit sink
writes to the application log rather than the dashboard's own database, which is
the thing an operator with dashboard access could edit.

**There is no ffmpeg.** #2578 asked whether video was in scope given the
external binary, its licensing and its provisioning; `@stacksjs/video` is built
on `ts-videos`, which encodes itself, so that question was already answered.

Tags go through `taggables` + `taggable_models` with `taggable_type =
'storage_items'` - the trait the CMS already uses. Do NOT declare a
`belongsToMany` to the `Tag` model for this: `taggable_models.tag_id` resolves
against `taggables`, which is a different table from `tags`.

### Data Management
- `/data/dashboard` - data overview
- `/data/users` - user management
- `/data/subscribers` - subscriber management
- `/data/teams` - team management
- `/data/activity` - persisted activity
- `/models`, `/models/{model}` - generic model registry and explorer
- `/notifications/dashboard`, `/notifications/history` - notification operations

### Mail
- `/inbox` - inbound messages from the configured mailbox provider
- `/inbox/activity` - inbound and outbound delivery activity
- `/inbox/captured` - outbound messages captured by the local log mail driver
- `/inbox/settings` - mailbox display and behavior preferences

Captured mail uses `GET /api/dashboard/email/captured` and
`GET /api/dashboard/email/captured/{id}`. Read captures through the shared
parser in `Actions/Dashboard/Email/captured-mail.ts`; do not scrape files in an
STX component or duplicate the log-driver format. Render all inbound and
captured HTML through `Email/EmailBodyPreview.stx`. It owns the sandboxed
`srcdoc` iframe, restrictive content policy, and no-referrer boundary. Never
inject message HTML into the dashboard document.

### Marketing
- `/marketing/campaigns` - campaign management
- `/marketing/lists` - email list management
- `/marketing/social-posts` - social post management
- `/marketing/reviews` - marketing review workflows

### Library
- `/library/components` - component browser
- `/functions` - function registry and scaffold
- `/releases` - release management
- `/packages`, `/dependencies` - package and dependency inspection

### Settings
- `/settings` - typed `config/*.ts` browser and editor
- `/settings/appearance` - dashboard appearance
- `/settings/billing` - account billing
- `/settings/mail` - mail configuration
- `/environment` - environment summary
- `/access-tokens` - access-token management
- `/cloud`, `/dns`, `/mailboxes` - infrastructure-specific settings

### Deployments
- `/deployments` - deployment history, deployment controls, the custom
  TypeScript deploy-script editor, and visibility-aware live terminal output
- `/deployments/{id}` - one persisted Deployment model record

The deployment page composes `DeploymentList`, `DeploymentTable`,
`DeploymentPreviewDialog`, `DeployScript`, and `LiveTerminalOutput`. The
Preview action first collects the environment and optional domain, then calls
the guarded `POST /api/dashboard/deployments/preview` Action. That Action runs
the native `buddy deploy --dry-run --json` planner and returns its versioned,
non-mutating plan. The dialog renders the ordered operations and resolved sites
before the user may continue to the separate real deployment confirmation.
Script reads and atomic writes use
`GET|PUT /api/dashboard/deployments/script`. The terminal uses
`GET /api/dashboard/deployments/terminal` and pauses polling while the document
is hidden. Do not create separate `/deployments/scripts` or
`/deployments/live-terminal` pages.

Deployment recovery uses `POST /api/dashboard/deployments/rollback/preview`
followed by `POST /api/dashboard/deployments/rollback`. The preview must run
the native `buddy deploy:rollback --dry-run` path successfully, and execution
must re-run that preview, compare its revision, and require the typed target
environment confirmation. Never implement rollback by editing release links,
restarting services directly, or guessing a prior release from Deployment
model rows. Deployment rows are application history. Preserved releases and
activation are owned by ts-cloud.

### Operations control plane

The Operations sidebar entry deliberately remains one item. Section navigation
lives in `Dashboard/Operations/OperationsNavigation.stx`:

- `/operations/changes` - unified change review, active work, release approvals
- `/operations/scheduler` - registered task runs and persisted pause state
- `/operations/recovery` - destinations, policies, recovery points, restore drills
- `/operations/migrations` - model diff, schema effects, ledger reconciliation
- `/operations/incidents` - native alerts, health rules, ownership, silence state
- `/operations/audit` - append-only operator events and correlations

Operational state belongs in the ts-cloud control plane initialized by
`Operations/control-plane.ts`. Use its stores for durable operations, events,
releases, approvals, alerts, backups, actors, and environments. Do not create a
parallel dashboard-only JSON file or duplicate those entities in application
models. Application domain records still follow the normal `app/Models` and
`useApi` convention. Use dashboard Actions for aggregate operational views and
guard every route in `dashboard-api.ts`.

Every mutating operator action must resolve the authenticated actor and append
or correlate a control-plane event. Use `trackOperatorOperation()` for bounded
synchronous work and the native durable queue for long-running backup, restore,
or provider work. Empty states must reflect real absence of configuration or
events. Never seed operational pages with sample incidents, releases, backups,
or health data.

Migration execution must start from `previewPendingMigrations()`, audit the
ledger against live schema effects, hash the reviewed plan, and recheck it
immediately before `buddy migrate`. Only `reconcileMigrationLedger()` may
repair provable ledger drift. Partial and unverifiable migrations require human
review and must not be silently recorded.

### Utilities
- `/health`, `/insights`, `/logs` - operational health and logs
- `/servers`, `/serverless`, `/realtime` - runtime infrastructure
- `/management/permissions` - RBAC management
- `/kanban` - model-backed board management
- `/ci`, `/buddy` - CI and Buddy workflows

## Dashboard Components (250+)

### Layout Components
- `Navbar` - top navigation bar
- `Sidebar` - fixed desktop side navigation provided by the STX runtime
- `MobileSidebar` - responsive drawer around the same sidebar content
- `DashboardLayout` - reusable layout wrapper

### UI Components
- Buttons, Modals, Toasts, Alerts, Dropdowns
- Tables with sorting, filtering, pagination
- Forms with validation
- Charts and analytics widgets
- File upload components
- Rich text editors

### Action controls

- Use `Dashboard/UI/Button.stx` for every dashboard action. Do not add page-local
  primary, secondary, success, warning, or danger button styles.
- The `primary` variant is the canonical Deployment `Deploy` treatment:
  `bg-gradient-to-b from-blue-500 to-blue-600`.
- Keep native buttons only for controls whose visual state is their meaning,
  such as tabs, sort headers, color choices, and full-surface modal backdrops.
- Use `variant="secondary"` for supporting actions and `variant="danger"` for
  destructive confirmation actions.
- Use `tag="a"` whenever `href` is reactive, for example
  `<Button tag="a" :href="detailsPath()">Open details</Button>`. Server rendering
  cannot infer an anchor from a client-only reactive URL.
- When a submit action lives in a shared Modal footer, give the form a stable
  `id` and associate the action with `<Button type="submit" form="form-id">`.
  Do not duplicate the footer inside the form or use script-driven submission.
- Prefer component events and named slots over string callback props or
  `data-action` markers. A `data-action` attribute is only valid when an active
  host integration consumes that exact action.

### Feature Components
- `ProductForm`, `ProductList`, `ProductVariants`
- `OrderTable`, `OrderDetail`, `OrderStatusUpdate`
- `UserTable`, `UserForm`, `UserProfile`
- `PostEditor`, `PostList`, `PostPublish`
- `CouponForm`, `CouponList`
- `EmailCompose`, `EmailList`, `EmailDetail`
- `DeploymentList`, `DeploymentTable`, `DeploymentDetail`, `DeployScript`,
  `LiveTerminalOutput`
- `JobMonitor`, `QueueStatus`
- `SettingsForm` (generic, used by all settings pages)

## Dashboard Actions

Located in `storage/framework/defaults/app/Actions/Dashboard/`:
- Settings actions - get and update typed settings
- Commerce actions - CRUD operations for commerce models
- Content actions - CRUD operations for content models
- Data actions - persisted model records and metrics
- Deployment actions - deploy, script, terminal, and history operations
- Job actions - job records and metrics
- Notification actions - notification records and delivery metrics
- Request actions - captured request analytics

## Model Dashboard Integration

Models with `dashboard: { highlight: true }` appear prominently:
```typescript
defineModel({
  name: 'Product',
  dashboard: { highlight: true },  // highlighted in dashboard
  traits: {
    useApi: { uri: 'products', routes: ['index', 'store', 'show', 'update', 'destroy'] }
  }
})
```

The `useApi` trait auto-generates REST actions and routes for the model. The
generic model explorer discovers the model separately. It does not generate a
custom dashboard page.

Use a dashboard-scoped Action when a page needs an aggregate response or a
purpose-built transport shape. Register it under `/api/dashboard/*` in
`storage/framework/defaults/routes/dashboard-api.ts`. Sensitive reads and all
writes must use the route file's `guard()` boundary so local development stays
usable while non-local environments require authentication and an admin role.

The dashboard dev server delegates `/api/*` requests to the Stacks router. It
does not delegate root-level application API groups such as `/payments/*`.
Dashboard pages must call a registered `/api/dashboard/*` Action instead of
hard-coding the separate API server port. User-scoped payment data is the
exception to the local no-auth guard: register it with `authenticatedGuard()`
so the bearer token is required even on localhost.

For stateful settings, persist through a model with `useApi` and explicit
middleware, then expose a narrow dashboard Action for the page. Keep account
identity fields read-only when their source of truth is `config/*.ts`.

### Dashboard API client

Use the shared `dashboardApi()` client for every dashboard network request,
including requests in stores and guest pages. Do not call `fetch()` directly
from dashboard views, components, composables, or stores. The shared client
adds the stored bearer token, same-origin credentials, JSON serialization,
the double-submit CSRF header for mutations, and normalized response errors.

Pass `auth: false` only for a deliberately public route such as password-reset
or invitation-link lookup. This disables the bearer header, not CSRF
protection. Keep the route path aligned with the registered Stacks route, for
example `POST /password/forgot`, rather than inventing a page-shaped API path.

Most dashboard APIs must be registered Actions so the router applies guards,
method metadata, rate limits, and default-on CSRF protection. If a development
handler must intentionally remain outside the router, call
`validateDevCsrfRequest()` before reading or mutating state. Never reproduce
the token comparison in a handler.

## Dashboard Development

```bash
buddy dev --dashboard        # start dashboard dev server
buddy dev -d                 # alias
buddy build components       # build component libraries
```

`buddy build:components` remains the direct command alias. Prefer
`buddy build components` in documentation and agent workflows.

Port: 3002 (configured in `config/ports.ts` as `admin`)

### Render performance

The dashboard dev action opts into STX's dependency-aware rendered HTML cache
with `renderCache: true`, `renderCacheVary: 'source'`, and four prewarm workers.
This is correct because static dashboard routes render source-derived shells
and load live records through `dashboardApi()` after hydration. Keep the
project and framework `resources/functions` roots in `watchDirs` so a
composable edit invalidates its client bundle.

Do not add request-specific server output to a source-cached static dashboard
route. If a route must render cookies, identity, query-dependent data, or
another per-request value on the server, set `const __stx_skip_cache = true`
in its `<script server>` or change that server to request-varying cache
semantics. Dynamic file routes remain uncached. STX also refuses to cache a
recovered compiler-failure response, so a transient cold render cannot poison
later navigation.

### Runtime shell and responsive navigation

`buddy dev --dashboard` renders its shared shell from
`storage/framework/defaults/views/dashboard/layouts/default.stx`. Do not
mistake `storage/framework/defaults/resources/layouts/dashboard/default.stx`
for the active dev-dashboard layout. The resources layout is a reusable legacy
layout and changes there alone do not affect port 3002.

The runtime shell owns the fixed desktop `Sidebar`, content offset, role
filtering, active-route synchronization, Craft selection bridge, global search,
and toast layer. Keep those behaviors centralized in the layout. The mobile
drawer behavior belongs in `Dashboard/MobileSidebar.stx`, with the layout
passing the same `Sidebar` sections through its slot. This preserves one
navigation source and the existing sidebar theme across form factors.

Persisted shell appearance is applied with STX's
`@appearanceBootstrap({...})` directive before the shell markup. Keep the
storage key and defaults aligned with `composables/useAppearance.ts`. Never
replace it with raw `window`, `document`, or `localStorage` code in the layout.

At widths below 1024px:

- Hide the fixed desktop sidebar and reset `[data-stx-content]` to
  `margin-left: 0`.
- Show the mobile menu bar and render the same Sidebar inside the drawer.
- Apply role filtering and active-route state to both sidebar panes.
- Trap focus inside the open drawer, close on Escape and STX navigation,
  restore focus to the menu button, and lock background scrolling with the
  native `useScrollLock()` composable.
- Verify `document.documentElement.scrollWidth <= innerWidth` at phone and
  tablet sizes.

At 1024px and wider, the desktop sidebar must retain its existing theme,
250px width, fixed placement, persisted collapse state, and
`--stx-sidebar-width` content-shell contract.

### Reactive page components

Keep route views thin. Place stateful page implementations under
`storage/framework/defaults/resources/components/Dashboard/` and render them
from the route view as normal STX components. Use signals, `onMount`,
`useReactiveProp()`, and `defineEmits()` rather than direct DOM access or
page-global scripts.

Every async page needs loading, error, empty, and populated states. Dashboard
Actions should return persisted data only. Do not hide failed endpoints behind
sample or randomly generated rows.

### Action buttons

Use `Dashboard/UI/Button` for dashboard actions. Its primary variant is the
blue gradient used by the Deploy action on the Deployments page, and that is
the canonical primary action style across the dashboard.

```html
<Button @click="openCreate">
  <span aria-hidden="true" class="h-4 w-4 i-hugeicons-add-01"></span>
  Create
</Button>

<Button :loading="saving()" type="submit">Save changes</Button>
<Button :loading="saving()" type="submit" form="settings-form">Save from modal footer</Button>
<Button variant="secondary" @click="close">Cancel</Button>
<Button :loading="deleting()" variant="danger" @click="destroy">Delete</Button>
<Button tag="a" :href="exportHref()" :download="exportFilename()">Export</Button>
```

Use its `primary`, `secondary`, `outline`, `ghost`, `danger`, and `success`
variants instead of repeating color, border, radius, shadow, disabled, or
loading classes in feature components. Pass `href` for a statically known
navigation action. For a reactive link or download, set `tag="a"` so the
component renders the correct element during the server pass, then bind
`href` and `download`. Use `iconOnly` with `ariaLabel` for an icon action, and
`fullWidth` when the action must fill its container.

Keep semantic controls such as tabs, switches, pagination state, window
controls, dialog backdrops, and table row menus in their dedicated components.
They are controls, not alternate action-button styles.

### Sidebar-aware overlays

The desktop sidebar is fixed and publishes its current width through
`--stx-sidebar-width` on the dashboard content shell. Fixed dialogs and
drawers must use the shared `dashboard-modal-layer` class so their interactive
surface starts beside that sidebar and returns to `left: 0` on mobile and in
the Craft native-sidebar shell.

Use `Dashboard/UI/Modal`, `Dashboard/UI/Drawer`, and
`Dashboard/UI/ConfirmDialog` for page dialogs, inspectors, forms, and
confirmations. They own native `<dialog>` behavior, scroll locking, focus
restoration, Escape and backdrop handling, accessibility labels, and the
sidebar-aware boundary. `Dashboard/Modals/BaseModal` and
`Dashboard/Modals/Popups/Alert` are compatibility wrappers over that same
primitive, not alternate overlay implementations.

Do not add a page-owned `fixed inset-0` overlay. A purpose-built application
surface such as the global command palette or mobile navigation may own a
custom layer only when the shared dialog or drawer semantics do not fit. It
must still use `dashboard-modal-layer` and provide complete keyboard, focus,
and ARIA behavior. Do not solve sidebar overlap by increasing z-index alone.

### Live dashboard audit

Start `./buddy dev --dashboard`, then run the dependency-free live audit from
the project root:

```bash
bun storage/framework/defaults/ai/skills/stacks-dashboard/scripts/audit.ts
# Or target a non-default origin:
bun storage/framework/defaults/ai/skills/stacks-dashboard/scripts/audit.ts --base-url http://127.0.0.1:3002

# Exercise hydrated navigation, console errors, failed requests, and layout:
bun storage/framework/defaults/ai/skills/stacks-browse/scripts/browse.ts crawl http://localhost:3002/ --max 500 --settle 350 --summary
```

Pass a base URL as the first argument when the dashboard is not on
`http://127.0.0.1:3002`. The audit discovers route views, model destinations,
and representative parameterized pages. It requests every page as both a full
document and an `X-STX-Router` fragment, then crawls every registered GET
dashboard API. It fails on missing page renders, invalid fragment contracts,
empty or non-HTML pages, unresolved component tags, 5xx or method-mismatch
APIs, HTML API fallbacks, invalid JSON, and HTTP-200 error payloads.

The dependency-free browser crawl follows the rendered link graph in a real
browser and fails on non-200 pages, console errors, failed subrequests, or
horizontal overflow. Seed source-only routes with repeated `--path` flags,
including optional or parameterized pages that the current data set does not
link. The HTTP audit and browser crawl cover different boundaries, so run both
for exhaustive dashboard work.

Run this after dashboard route, Action, STX, model, migration, or dev-server
changes. Record provider-backed or destructive success paths as explicit
environment boundaries. Never replace a failed live contract with sample data
or a fake success response.

## Gotchas
- Dashboard runs on port 3002 by default (separate from frontend on 3000)
- Dashboard components use STX templating with crosswind CSS
- Dashboard routes are registered from `storage/framework/defaults/routes/`, not from a generated type file
- Settings panels read/write from the corresponding `config/*.ts` files
- Models with `useApi` get generated REST actions and routes, not bespoke dashboard views
- `dashboard: { highlight: true }` makes models prominent in the dashboard
- Dashboard layout uses a sidebar + navbar pattern
- All dashboard actions are in `storage/framework/defaults/app/Actions/Dashboard/`
- Split repeated or stateful page regions into `.stx` components under `resources/components/Dashboard/`; pass reactive values with `useReactiveProp()` and communicate upward with `defineEmits()`
- Preserve the existing sidebar information architecture and styling when redesigning page content
- Use `dashboard-modal-layer` for every fixed dashboard dialog or drawer
- The live terminal component polls real deployment output and pauses while the document is hidden
