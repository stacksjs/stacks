---
name: stacks-dashboard
description: Use when building or customizing the Stacks admin dashboard, including dashboard pages, model management views, analytics widgets, commerce dashboards, content management, settings panels, deployment monitoring, job/queue management, or the 428 built-in dashboard components. Covers the dashboard system at storage/framework/defaults/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Dashboard

The Stacks admin dashboard provides a full-featured admin panel with 100+ route views, 428 components, and a multi-section layout.

## Key Paths
- Dashboard components: `storage/framework/defaults/resources/components/Dashboard/`
- Dashboard route views: `storage/framework/defaults/views/dashboard/`
- Dashboard layouts: `storage/framework/defaults/views/dashboard/layouts/`
- Dashboard actions: `storage/framework/defaults/app/Actions/Dashboard/`
- Dashboard page endpoints: `storage/framework/defaults/routes/dashboard-api.ts`
- Dashboard navigation registry: `storage/framework/defaults/resources/functions/dashboard/sidebar.ts`
- Configuration: `config/ui.ts`

## Dashboard Sections

Enable/install the dashboard feature before expecting its default route bundle
and owned application scaffolds. Keep custom page/component overrides under
`resources/` and custom Actions under `app/` at their matching relative paths.
The sidebar registry determines navigation; a page existing on disk does not
add a sidebar entry or authorize its data Action. Feature sections can be
disabled independently in configuration. Pair new model views with
`stacks-models`, `stacks-actions`, and the route registry actually mounted.

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
  `optimize` (images, via `ts-images`), `transcode` (video, via `ts-videos`),
  `tag` (a vision model) or `preview` (the file manager thumbnail, #308). They succeed and fail independently, which is why this
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
- `preview` is decided by `file-preview.ts`, from the type the file CLAIMS
  (the disk's answer, or the extension when that is `octet-stream`), and the
  job checks the bytes agree before drawing. Images, WAV waveforms and TrueType
  specimens become `.variants/<path>/preview.png`; text becomes a
  `preview.txt` snippet. SVG, video, compressed audio, PDF, CFF/WOFF fonts,
  HEIC and TIFF are recorded `skipped` with the reason in `error` - no
  homegrown renderer draws them, and SVG is never rasterized. Never add a
  renderer that shells out: that is the rule the skips exist to keep.
- `skipped` is terminal: `runTask` records a thrown `StorageTaskSkipped`
  without rethrowing, so the queue does not retry it, and `aggregateTaskState`
  ignores it unless nothing else applied.

Derivatives are written back to the same disk under `.variants/<path>/`. The
leading dot keeps them out of the listing, which skips hidden components - a
folder of thirty derivatives beside every photo makes the browser useless.
A rename or delete through the dashboard moves or removes that folder with the
file, after the storage operation succeeds and best effort, since the task rows
already followed and a missing derivative is regenerated by reprocessing.

### Remote commands (stacksjs/stacks#960)

Running a configured operation on a configured host over SSH: the request
names a host KEY and a command KEY, both from `config/remote.ts`, so there is
nothing to escape and no shell to reach. The interactive terminal beside it is
covered below.

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

### Remote terminals (stacksjs/stacks#960)

`/remote` in the dashboard also opens an interactive shell on a host that sets
`terminal: true`. Every command-runner rule above holds, plus:

- **A host opts in, and a gate decides.** `terminal: true` on the host, and the
  `open-remote-terminal` gate (receives the host key). No gate, no session.
- **A session belongs to the user who opened it.** 128-bit id; another user
  naming it gets the same 404 as a missing id.
- **It does not outlive its purpose.** 15 minutes without input, 2 hours in all,
  30 seconds after the last viewer leaves: the remote shell is killed, never
  left running. At most 4 per user.
- **What is typed is audited line by line** in the application log, so hosts
  should take keys and passwordless sudo, not typed passwords.

Transport: a local PTY (`Bun.spawn({ terminal })`, which Bun now has) running
`ssh -tt` with the pinned host key, so a browser resize reaches the remote side.
Output reaches the browser as server-sent events, base64 and sequence-numbered
for replay on reconnect; input and resize are small POSTs that each pass auth,
CSRF and the session-owner check. Sessions live in the server process.

In the browser it is `<stacks-remote-terminal host="...">` (xterm.js), from
`functions/remote-terminal-element.ts`. Two rules that module follows:

- **Nothing browser-only at module top level.** `defaults/functions` is also
  auto-imported on the SERVER; a top-level `class extends HTMLElement` threw
  there and took every function in the barrel down. xterm and the class load
  inside `registerRemoteTerminal()`.
- **Survive being moved.** stx's `:if` detaches and re-inserts the SAME nodes, so
  the element acts on a removal only if it is still detached a tick later, and
  starts a fresh session whenever it is attached again.

`remote-terminal.test.ts` runs a real session through a throwaway user-level
`sshd` on a loopback port when one is installed (macOS and the CI image both
have one), including a host whose key does not match the pinned one.

**There is no ffmpeg.** #2578 asked whether video was in scope given the
external binary, its licensing and its provisioning; `@stacksjs/video` is built
on `ts-videos`, which encodes itself, so that question was already answered.

Tags go through `taggables` + `taggable_models` with `taggable_type =
'storage_items'` - the trait the CMS already uses. Do NOT declare a
`belongsToMany` to the `Tag` model for this: `taggable_models.tag_id` resolves
against `taggables`, which is a different table from `tags`.

### Data Management
- `/data/dashboard` - data overview
- `/data/users`, `/data/subscribers`, `/data/teams` - the model's own list
  under the page's title and stats (see "Users, Teams and Subscribers are the
  model's list")
- `/data/activity` - persisted activity, read-only (`Data/ActivityLog.stx`)
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

## Who may reach a dashboard surface

Two axes, declared in different places.

**Route groups** are gated in `config/dashboard.ts`, keyed by the group's path
prefix:

```ts
access: {
  '/api/commerce': ['admin', 'superadmin'],
  '/dashboard/commerce': ['admin', 'superadmin'],
  '/cms': ['admin', 'editor'],
}
```

Each entry appends `role:<the list>` after that group's `auth`, so any one of
the named roles admits. Every group ships `auth` and nothing more, so an
omitted group stays reachable by any signed-in user; naming it is the only way
to tighten it, since `defaults/routes/dashboard.ts` is framework-owned
(stacksjs/stacks#2883). Keyed by prefix, so gating `/api/commerce` does not
gate `/dashboard/commerce`: name both when you mean both. The prefixes are a
typed union, so a typo is a compile error rather than a gate that is quietly
absent.

**A model's own generated API** is gated on the model, not here: either
`dashboard: { roles: ['admin'] }`, which gates the sidebar row and every
generated route together, or `useApi.middleware` for per-ability control. See
`stacks-models`.

**The sidebar** filters itself. A row carrying roles (from a model's
`dashboard.roles` or a `nav` item's `roles`) is hidden client-side from viewers
holding none of them, permissively for unauthenticated viewers so the local dev
dashboard stays usable (#1843). That is presentation: it hides the link, not
the endpoint, so it is never the gate on its own.

**SSR pages** take the same middleware names as an API route, because the page
servers build their registry from `app/Middleware.ts`:

```stx
definePageMeta({ middleware: ['auth', 'role:admin'] })
```

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
with `renderCache: true`, `renderCacheVary: 'source'`, and no prewarming.
This is correct because static dashboard routes render source-derived shells
and load live records through `dashboardApi()` after hydration. A page's first
visit costs its own render (about a second); later visits come from the cache.
Prewarming rendered every route on the serving thread, and pages took 3-28s
while it ran (stacksjs/stacks#2964), so it stays off.

`renderCachePersist: true` keeps those renders in `storage/framework/stx/render-cache/`,
so a restart serves pages already rendered instead of rendering them again
(stacksjs/stacks#3035). A kept page is used only while nothing it was rendered
from has changed: its templates, every watched file, the lockfiles, `.env`
files and stx config. Watched roots therefore matter twice. Keep in `watchDirs`:

- the project and framework `resources/functions` roots, so a composable edit
  invalidates its client bundle;
- `config/` and `storage/framework/runtime/dashboard/`, which hold what the
  layout builds the sidebar from (`config/dashboard.ts` and the models
  manifest). Without them a restart after a config edit serves the old sidebar.

Anything else a dashboard server script reads at render time belongs in
`watchDirs` too. The models manifest is written only when its content changes,
so a restart alone does not discard the kept pages.

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
the Craft native-sidebar shell. The class owns the layer's whole horizontal
box (`left`, `right` and `width`), so a dialog is centred over the content and
a drawer ends at the window's edge. Do not put a width utility (`w-screen`,
`w-full`) on an element that carries it: beside `left: 250px` that runs the
layer a sidebar's width past the window. The rule's selector is
`html .dashboard-modal-layer`, so it outweighs `inset-0` whichever stylesheet
loads last; a bare class did not, and dialogs moved depending on how the page
was reached.

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
- Dashboard components use STX templating with ts-css utilities
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

## Generic model exposure

Set `dashboard: { access: false }` on a model to exclude it server-side from
the generic model catalog and its totals, legacy highlighted model counts,
User/Subscriber count Actions, global model search, and generic model-browser
read/store/update/destroy Actions. Direct model-browser requests return 404
before row queries. Omission preserves existing exposure.

`dashboard.enabled: false` only hides a sidebar row and still permits generic
model access. `access` does not disable direct ORM calls, named domain Actions,
or separate routes generated by `useApi`. Configure `security.api.models` or
`STACKS_MODEL_APIS`, middleware, ownership and policies for those APIs. The
new boundary does not provide row ownership or permission checks for models
that remain exposed.

### Asking which models exist

Dashboard code asks through `resolveDashboardModel(name, candidate?, sources?)`
and `dashboardModelSources()` in `resources/functions/dashboard/model-access.ts`,
which read directory listings only (`listModelSources` from
`@stacksjs/database/model-sources`). Anything that resolves many models reads
the list once and hands it to each resolve:

```ts
const sources = dashboardModelSources()
for (const source of sources) {
  const Model = await resolveDashboardModel(source.name, (await import(source.file)).default, sources)
}
```

Never call `resolveModelSources()` while serving a request. It is the
migration generator's entry point: when framework defaults are merged in it
deletes and rebuilds its staging directory (a symlink per model) on every
call, about 11ms of blocking file writes. The models overview once asked it
per model and took 1.6s; it answers in about 6ms now.
`tests/unit/dashboard-model-sources.test.ts` fails if a dashboard Action or
function uses it.

## What the dashboard may write to a model

Every record has a page to view it (`/models/{slug}/{id}`), and where the
model allows, a page to edit it, a page to create one, and a delete behind a
confirmation. Table rows carry the same three as icons: eye, pencil, trash.

Which of those a model gets comes from one of two places:

- Left alone, the dashboard offers the writes the model's `useApi` routes
  declare (`store`, `update`, `destroy`).
- `dashboard: { writes: [...] }` names them instead, wider or narrower. Use it
  when an operator should be able to do what the API should not offer. `User`
  declares `writes: ['store', 'update', 'destroy']` and keeps `update` and
  `destroy` off its API, where a generated PATCH would let a caller change
  their own email and password outside the flows that verify them.
  `writes: []` makes a model read-only in the dashboard whatever its API
  allows.

These writes go through the dashboard's own guarded endpoints
(`/api/dashboard/models/{slug}`), so naming one opens nothing on the public
API. Creating still needs a form that can supply every required field: a
model with a required hidden field, like `User.password`, is not creatable
here even when `store` is named.

### What the forms ask for, and how

The create and edit forms offer a model's `fillable` attributes, less the
`hidden` ones and the protected columns (`password`, tokens, secrets, `id`,
`uuid`, the timestamps), plus the foreign key of each `belongsTo`. The server
applies the same list, so a request naming anything else is ignored.

Each field's control follows its validation rule (`modelFieldType`), and both
forms draw them with one component, `Dashboard/Models/ModelFieldInputs`:

| Rule | Control | Stored as |
|---|---|---|
| `enum` | select of its allowed values | the value |
| `boolean` | checkbox | true or false |
| `number`, `integer`, `float`, `unix` | number box | a number |
| `date` | date picker | the calendar day |
| `timestamp`, `timestampTz`, `datetime` | date and time, in the visitor's zone | UTC `YYYY-MM-DD HH:MM:SS` (ISO for `timestampTz`) |
| a declared `belongsTo` | search for the related record by name | its id |
| `json` | tall fixed-width box, checked on save | JSON text |
| `string` with `type: 'text'` | tall box | text |
| any other `string` | one line (`email` when the name says so) | text |

An edit sends only the fields that were changed. Labels, and the
model's own name in titles, come from `humanizeIdentifier` ("Social Post",
"Image URL").

### Relations are picked by name

A `belongsTo` is stored as an id and asked for as the record: each one is a
`relation` field drawn by `Dashboard/Models/ModelRelationPicker`, a search box
that lists the related model's records and stores the chosen one's id. It is
one field whether the model leaves the key to the relation (`belongsTo:
['Team']`) or also spells it out as an attribute (`userId`). Both spellings of
a relation are read, the object form and its `foreignKey` included.

Only a declared `belongsTo` is a relation. Other fields ending in `Id`
(`externalId`, `providerMessageId`, a polymorphic `subjectId`) stay as they
are, and so does a relation to a model the dashboard cannot reach (its
feature is off, or `dashboard.access` is false).

`GET /api/dashboard/models/{slug}/options` backs the picker: `?q=` searches by
what a record is called and `?ids=3,7` names exactly those. A record is called
by the first of `name`, `title`, `label`, `subject`, `email`, `domain`, `code`,
`slug` the model has, with a person's email beside it, and by `Model #id` when
it has none of them (such a model is searchable by id only).

A record's page shows each relation as a link to the related record, by name.
A write naming a record that has since been deleted comes back on that field
("That team no longer exists. Choose another.").

### A model chooses its list columns

A model's list (`/models/{slug}`) shows every column its table has unless the
model names the ones it wants, in order:

```ts
dashboard: { columns: ['name', 'email', 'team', 'createdAt'] }
```

A name is an attribute (`createdAt`), its column (`created_at`), or a
`belongsTo` (`team` for `team_id`). The same choice shapes the model's panel
on another record's page. The record's own page still shows every field.

It narrows what is drawn, not what is reachable: every column can still be
sorted and filtered on, a `hidden` attribute stays hidden if it is named, and
a column the list is filtered on is drawn even when the model left it out, so
the filter can be seen and cleared. A name the table does not have is left
out and logged once (`[dashboard] User names 'nickname' in
dashboard.columns...`); a list of nothing but such names falls back to every
column.

The shipped models that people browse name theirs (43 of them, the widest
going from 34 columns to 6): what the record is called, the records it links
to, its status, and its most useful number or date. A model you add shows
every column until you choose. `tests/unit/dashboard-model-columns.test.ts`
checks that every shipped choice names real, showable columns.

In any list, a column that holds another model's id shows that record's name
as a link to it ("PrimeSoft Ltd", not `3`), under the model's name ("Team",
not "Team ID"). The list endpoint returns the names with the rows
(`relationNames`), one lookup per related model per page, and a record's page
uses the same ones.

### A list's filters and sort are derived, not declared

Nothing declares a filter. `Models/model-filters.ts` reads which filters a
list offers from what the model already says:

| Signal | Where | Decides |
|---|---|---|
| What the field is | its validation rule | whether it is a filter, and its control |
| What results are narrowed by | `traits.useSearch.filterable` | offered first; a number or a line of text is only a filter when named here |
| What is private | `hidden` | never offered, and never sortable |

| Field | Asked for as |
|---|---|
| A few allowed values (`schema.enum`) | pick any of them |
| Yes or no (`schema.boolean`) | Yes / No |
| `belongsTo` | the record picker the forms use |
| A date or a moment | two days, and Today / Last 7 days / This month |
| A number the model names | at least / at most |
| Text the model names | chosen from the values the table holds when there are 20 or fewer (`withStoredChoices`, remembered for 30 seconds), else an exact value |

Prose and structures are searched, not filtered. A filter is what the model
says the field is, never a guess from its name: a yes-or-no declared
`schema.number()` is a number range until the model says `schema.boolean()`.

```ts
dashboard: { filters: ['status', 'team', 'createdAt'] }
```

names and orders them instead, in the vocabulary `dashboard.columns` uses (an
attribute, a column, or a `belongsTo`). An empty list means no filters. A
name that cannot be used is left out and logged once.

On the page (`Models/ModelFilterPanel.stx`) the Filter button opens a panel
of those controls. What narrows the list is always shown as chips ("Channel:
Email, SMS"), each with a clear button, and is written to the address
(`modelListAddress`), so a narrowed list can be sent to someone.

On the wire, `filters` is a JSON object by column:

| Value | Means | For |
|---|---|---|
| `"3"` | exactly this | any column the page is sent (what a record's panel links with) |
| `{ "in": ["a", "b"] }` | any of these | a choice, a relation, named text |
| `{ "from": "...", "to": "..." }` | from, up to | a date (days, both included) or a moment (instants, end not included) |
| `{ "min": 1, "max": 9 }` | between | a number the model names |

Each is checked against the field's kind and refused with a 422 in words
before the database is asked ("Channel is not a date, so it has no range of
days."). For a moment the page sends where the viewer's first day starts and
where the day after their last one does (`modelFilterRange`), so "the 5th" is
the viewer's 5th.

The response carries `filterable` (the filters) and `sortable` (the columns a
heading orders by). Any stored value can be sorted. Prose, structures and
columns that point at another record cannot: the cell shows that record's
name, and ordering by its id would look random. Their headings are plain.

Not built: filters that are not one column ("Overdue"), saved views, and
ordering a relation column by the related record's name.

### A model says how a field is called, shown and asked for

An attribute says what a field is. It cannot say that `amount` is money and
`sizeBytes` is a size (both are numbers), or that `created_at` is called
"Joined" here. `dashboard.fields` is where the model says so, one field at a
time; everything it leaves out stays derived.

```ts
dashboard: {
  fields: {
    createdAt: { label: 'Joined' },
    amount: { format: 'money', currencyField: 'currency' },
    sizeBytes: { label: 'Size', format: 'bytes' },
    duration: { format: 'duration', unit: 's' },
    notes: { input: 'longtext', help: 'Shown to the customer on their receipt.' },
  },
}
```

A name is an attribute (`createdAt`), its column (`created_at`), or a
`belongsTo` (`team` for `team_id`), as in `dashboard.columns`.

- `label` is what the field is called on every page that names it: the
  list's heading, the record's label, the form's input, a panel's column and
  the messages about it ("Order number is required."). One function,
  `modelColumnLabel`, resolves it, so the pages cannot disagree. Left out, it
  is the record a relation points at ("Team"), else the name in words, with a
  moment read as what happened: "Created", "Email Verified", "Last Updated".
- `format` is how the stored value reads in a list, on the record's page and
  in a panel:

  | Format | Stored | Reads as |
  |---|---|---|
  | `money` | minor units, in `currency` or the row's `currencyField` | `$12.00` |
  | `number` | a number | `12,500` |
  | `percent` | the share, 0 to 100 | `42.5%` |
  | `bytes` | a byte count | `1.5 KB` |
  | `duration` | milliseconds, or seconds with `unit: 's'` | `1 min 23 s` |
  | `date`, `datetime` | a day, or a moment | in the viewer's locale and zone |
  | `badge` | a status-like word | a pill |
  | `link` | a web or mail address | a link in a new tab |
  | `image` | a web address or a path on the site | a thumbnail |
  | `code` | an identifier, a token, SQL | a code font |
  | `text` | anything | as stored, undressed |

  Amounts line up on the right. A value the format cannot read is shown as
  stored, and a `link` or `image` only ever leads to an `http(s)` or mail
  address, or a path on the site.
- `help` is a sentence under the field's input in the create and edit forms.
- `input` picks the input a field of text gets: `text`, `longtext`, `email`,
  `url`, `markdown` or `upload` (both below). Only for text: what a value is
  stays the validation rule's to say, so a number cannot be asked for as
  prose.

It changes how a field reads, never what may be read or written: a `hidden`
attribute stays hidden, and a field that is not `fillable` stays out of the
forms. A setting that cannot be read is dropped on its own (a misspelled
format does not cost the field its heading) and logged once by name
(`[dashboard] Order dashboard.fields: 'total' asks for a format the dashboard
does not have: 'cash'...`).

Formatting happens in the browser (`functions/dashboard-model-format.ts`),
since it follows the viewer's locale and time zone; the list endpoint sends
each column's `label` and `format` in `columnMeta`.

The shipped models say so wherever the answer is certain
(`tests/unit/dashboard-shipped-declarations.test.ts` holds each kind to its
rule):

- **Units and addresses**: request and query durations, a deployment's
  duration (seconds) and address, an attachment's size.
- **A picture chosen as a file** (`input: 'upload', accept: 'image/*'`): a
  user's, an author's and a customer's `avatar`, a post's `poster`.
- **A picture shown as one** (`format: 'image'`): the `imageUrl` of a
  product, category, auction lot, loyalty reward and social post. These stay
  an address that is typed or pasted. A chooser would take away pointing at
  a picture kept elsewhere, so a field named for an address is not made an
  upload.
- **A web address box** (`input: 'url'`): a post's `canonicalUrl` and a social
  post's `imageUrl`, the two whose own rule already refuses anything else.
  The box refuses a path such as `/about` before the form is sent, so it is
  never put on a field that may hold one (a menu item's `url`).
- **Prose** (`input: 'longtext'`): descriptions, notes, bios, excerpts, meta
  descriptions, comment and card bodies, a post's `content`: 23 fields that
  were one line because their attribute is a plain string.

Nothing shipped is asked for as Markdown yet. A post's `content` is written
in Markdown, but the page the CMS builds from it renders only part of it (no
italics, quotes or numbered lists), and the editor's preview would show what
the published page does not.

Not offered yet: wording for single enum values.

### A field asked for as an uploaded file

```ts
fields: { avatar: { input: 'upload', accept: 'image/*' } }
```

A file chooser (`Dashboard/Models/ModelUploadInput`) whose value is the
address the chosen file was stored at. Choosing a file stores it at once;
the address is saved with the rest of the form, so nothing about a record
changes until then. What the field holds is shown (a thumbnail when it is a
picture) and can be replaced or removed. Removing empties the field; it does
not delete the file.

- `POST /api/dashboard/models/{slug}/uploads` (multipart `file` and `field`)
  only takes a file for a field the model asks for as `upload`, on a model
  the dashboard may write, up to 10 MB.
- It is kept on the `public` disk under `uploads/<table>/<column>/` with a
  generated name, through the pipeline the Files page uses, so it is listed
  there with its preview. That pipeline needs the `storage_items` and
  `storage_item_tasks` tables.
- `accept` is spelled as a file input spells it (`image/*`, `image/png`,
  `.pdf`, or several). The chooser offers those, and the server holds to
  them by what the file's bytes say it is (`uploadAccepts` in
  `model-upload.ts`), not what it was sent as: a script sent as `photo.png`
  is not an image. An SVG is taken only where it is named.
- Without a `format`, a field that only takes images is shown as a picture
  and any other upload as a link.

### A field asked for as Markdown

```ts
fields: { body: { input: 'markdown' } }
```

An editor (`Dashboard/Models/ModelMarkdownInput`) with a toolbar for the
common marks (bold, italic, heading, link, lists, quote, code) and a preview.
A button wraps what is selected, or marks the lines it touches, and comes
off again when pressed twice (`applyMarkdown` in
`functions/dashboard-markdown.ts`). The stored value is the Markdown itself.

The preview is rendered by the server (`POST /api/dashboard/markdown`: Bun's
Markdown parser, the one Stacks content is rendered with, then
`@stacksjs/sanitizer`) and shown in a sandboxed frame with a policy that
forbids script, as captured email is. It is never bound into the page.

This is Markdown, not a what-you-see-is-what-you-get HTML editor: there is no
editing engine in the stack. A record's page shows the Markdown as written,
with its line breaks; it is not rendered there. An action's input can be
asked for as `markdown` too, and never as `upload`.

### A record's page lists who points at it

For each `hasMany` and `hasOne` a model declares, its record page shows a
panel (`Dashboard/Models/ModelRelatedPanels`): a team's members and
invitations, a user's team memberships. Nothing is declared for the
dashboard; `GET /api/dashboard/models/{slug}/{id}/related` reads the model.

A panel is the newest five with the total. Its columns are the related
model's `dashboard.columns` when it names any. Otherwise they are chosen for
telling rows apart: what the related record is called, the other records it
points at (by name), its `enum` fields as badges, and when it was created.
Either way the link back to the page's own record is left out.

- The eye opens the related record.
- "View all" opens the related model's list narrowed to this record
  (`/models/team-member?filters={"team_id":"3"}`); the list arrives with its
  filter row open.

Where the related model lets the dashboard write its rows (its
`dashboard.writes`, else its `useApi` routes, as for its own pages), the
panel is where they are managed. Nothing is declared for it.

- "Add" opens a form over the page with this record already chosen, and the
  new row appears in the panel. It is offered when that model can be created
  from the dashboard, and for a `hasOne` only while there is none.
- The pencil opens the same form with the row's values, and sends only what
  changed.
- The trash asks first, then deletes the row.

The form asks for the related model's own fields the way its create and edit
pages do (`modelFormFields`: labels, help and inputs from `dashboard.fields`,
a picker for each relation the dashboard can reach), without the link back
to this record. The panel carries them as `fields`, and each listed row's
stored values as `values`; `canUpdate` and `canDestroy` say which buttons a
row gets. A refused write is shown in the form, under its field.

Each save is one write through the related model, on the endpoints its own
pages use (`POST`, `PATCH` and `DELETE /api/dashboard/models/{slug}`), so
casts, observers, validation and soft deletes apply and nothing new is
opened. The panels are read again afterwards.

There is no form that saves a record and its rows together, all or nothing.
A write made through a model takes no part in `transaction()`
(stacksjs/stacks#3269), so a combined save could leave the record changed
and a row not. Until the model layer joins a transaction, an operation that
must be atomic across models belongs in an action that writes through the
transaction's own handle.

The link between the two models is the foreign key the declaration names,
else the related model's own `belongsTo`, else the conventional
`<model>_id` column. With none of those the relation gets no panel; so does a
related model the dashboard cannot reach.

The edit form never writes `password`, tokens, secrets, `id`, `uuid` or the
timestamps. A refused save comes back as a message under its field (a rule
the value breaks, or a `unique` value another row holds). A delete the
database refuses because other records point at the row is reported as that,
and an account cannot delete itself.

### A model names its own actions

Everything above is derived from what a model is. A button that does
something ("Mark as shipped") is behaviour, so the model does not describe
it: it names it, and an action under `app/Actions` does the work.

```ts
dashboard: {
  actions: [
    {
      name: 'ship',                              // its place in the URL
      label: 'Mark as shipped',                  // else the name in words
      action: 'Actions/Orders/ShipOrderAction',  // as a route names one
      icon: 'i-hugeicons-truck-delivery',        // else a bolt
      confirm: 'The customer is emailed a tracking link.',
      when: { status: ['paid', 'packed'], shippedAt: null },
    },
  ],
}
```

- Each entry is a button on the record's page and an icon in its row of the
  model's list. `on: ['record']` or `on: ['row']` keeps it to one, and
  `'bulk'` offers it for the rows selected in the list (below).
- `when` names the records it is for: each field with the value, or list of
  values, a record must hold (`null` is "nothing stored"). A field may be one
  the dashboard hides. The server decides which rows are sent which action
  (`rowActions`, by row id) and checks again before running one, so asking
  for a hidden button is refused with a 409.
- `confirm` asks first, in the sentence given. `destructive: true` draws the
  button and its confirmation in red.
- An erased account is offered none.

`POST /api/dashboard/models/{model}/{id}/actions/{name}` runs the action **as
its own route would** (`resolveActionHandler` in `@stacksjs/router`): the
record's id is the `id` route parameter, so an action already served at
`/orders/{id}/ship` needs nothing changed, and its `validations`, `authorize`
and `before` all apply. The action needs no route of its own.

What it answers is what the operator is told:

- a refusal, returned or thrown with any status from 400 up, is shown with
  its `message`;
- a success may carry `message`, shown as the confirmation, and `redirect`, a
  dashboard path to open (`/models/order/31`). Without a redirect the page
  reads the record again, since what it is offered may have changed.

A declaration that cannot be read, or whose action cannot be loaded, is left
out and logged once by name (`[dashboard] Order dashboard.actions: 'ship'
names Actions/Orders/ShipOrderAction, which could not be loaded...`). A
handler string is not checked by the compiler, so this is checked when the
list is drawn, not when someone presses the button.

Five ship, each an action the framework already had, and each asks first.
Remove an entry to turn it off.

| Model | Button | Offered to | Where |
|---|---|---|---|
| `User` | Send password reset | every account | its page |
| `FailedJob` | Retry | every failed job | row, page, selection |
| `NotificationDelivery` | Send again | a failed email or text message | row, page |
| `Campaign` | Send now | an email campaign that is a draft, scheduled, paused or failed | its page |
| `Campaign` | Cancel delivery | an email campaign that is scheduled or sending | its page |

A campaign's two are on its own page only: sending reaches every subscriber
on a list, so it is not an icon in a table row. What an action refuses is
what the operator is told ("Email campaigns require an email list.").

### An action that takes input is asked for it

An action says what it takes in its own `validations`, and the dashboard
asks: pressing a button whose action validates anything opens a form over
the page (`Dashboard/Models/ModelActionForm`), not a confirmation.

```ts
// app/Actions/Orders/RefundOrderAction.ts
validations: {
  reason: { rule: schema.string().required().min(3), message: 'Say why.' },
  restock: { rule: schema.boolean() },
  method: { rule: schema.enum(['card', 'credit']).required() },
}
```

- One input per validation, in the control its rule calls for (text, a
  number box, a select for an enum, a checkbox, a date), required where the
  rule is. Route parameters such as `id` are never asked for.
- The form is the confirmation: the model's `confirm` sentence sits above
  the inputs, and nothing runs until it is submitted.
- What was typed is sent as the JSON body, as the action's own route would
  receive it, each value the type its rule expects. The action validates it
  as it always does; nothing is checked twice in two places.
- A refusal comes back in the form: under its field for a validation
  message, at the top for anything else ("Already refunded.").
- For a selection the form is asked once and its answers go to every
  record. If the first record refuses the input itself, nothing has run and
  the form says why.

The model can say how a field is asked, in the vocabulary `dashboard.fields`
uses (`label`, `help`, and `input` for a field of text):

```ts
actions: [{
  name: 'refund',
  action: 'Actions/Orders/RefundOrderAction',
  fields: { reason: { label: 'Reason for the refund', input: 'longtext', help: 'Shown to the customer.' } },
}]
```

An action that requires what a form cannot give (a list, a structure, a
file, a password) is left out and logged by name; an optional one of those
is simply not asked for. `resolveActionValidations()` in `@stacksjs/router`
is how the dashboard reads what an action takes.

### Rows are selected and acted on together

A model's list has a tick box on each row, and one in the heading for every
row on the page, whenever there is something to do with a selection:

- **Delete**, where the model lets the dashboard delete its rows. Nothing is
  declared.
- **The model's own actions** that name `'bulk'` under `on`, alone or beside
  `record` and `row`. Acting on many records is asked for by name; left out,
  an action is offered one record at a time.

With rows ticked, a bar above the table says how many and offers each of
those. Every one asks first, whatever a single press does, and the
confirmation says how many of the selection it applies to: a row an action's
`when` rules out, or an account already anonymized, is left alone and
counted. An action that applies to none of the selection cannot be pressed.

A selection is acted on **one record at a time**, each through the endpoint a
single row uses (`functions/dashboard-model-bulk.ts`). So an action needs
nothing changed to be offered in bulk, every guard a single press has
applies to each record (`when`, `authorize`, `validations`, the self-delete
guard, anonymizing a user others refer to), and the page shows how far it
has got.

It is not all or nothing, and does not claim to be: a write through a model
takes no part in a transaction (stacksjs/stacks#3269). The toast says what
happened: how many were done and, for the rest, which and why ("Order 8:
Already shipped."). A refusal about the record (any 4xx) goes on to the
next. A failure that is not (a 5xx, no answer at all) stops the run and says
where, so a broken backend is not pressed once per row.

A selection is the rows on the page; it is dropped when the list is read
again. Selecting every match across pages is not offered.

### A user other records refer to is anonymized, not refused

Many tables point at `users`, so anyone who has signed in, joined a team or
placed an order cannot be deleted, and deleting through all of those tables
from one trash icon would destroy far more than the operator sees. When the
database refuses to delete a `User`, the dashboard applies the app's erasure
rules instead (`eraseSubject`, the same thing `buddy gdpr:erase` runs): each
model's `gdpr` trait says whether that person's rows are deleted, anonymized
or kept, in one transaction with a `gdpr_requests` audit row recorded against
the admin who asked. With the shipped rules the account stays, its name,
email, avatar and password are replaced with placeholders, its tokens and
sessions are revoked, and the records that refer to it are kept.

The capability is `anonymize` (true for a deletable `User`), so the delete
confirmation says this before the button is pressed; the response carries
`anonymized: true` and the toast says "anonymized", not "deleted". A user
nothing refers to is still simply deleted. Every other model is still refused
with the reason.

An anonymized account is stored as `[erased]` / `erased-<id>`. A list never
shows those placeholders: the first erased column of the row reads
"Anonymized user" and the others "Removed", and its own page carries a note.
The list endpoint sends `anonymizedIds` (from `anonymizedRows('User', rows)`
in `@stacksjs/orm`, which asks the erasure plan whether a row's personal
columns hold what erasure writes) and, when there are any, `anonymizedColumns`
(from `personalColumns('User')`, narrowed to the columns the list is sent, so
a hidden password is never named). An anonymized account can be viewed and nothing else: its row
loses the pencil and trash (the table's per-row `when`), its page has no Edit
or Delete, and its edit address explains why there is no form. That is the
dashboard's choice of what to offer, not a rule of the endpoints: deleting
one again changes nothing, and a row given a real name and email again is an
account again.

### Users, Teams and Subscribers are the model's list

`/data/users`, `/data/teams` and `/data/subscribers` used to be a second,
hand-built list of a model that already had one, and the two drifted: row
actions, selection, bulk actions, action forms, column choice and filters
existed on `/models/{model}` and not where the sidebar leads, and the
hand-built pages read only the newest 100 rows. They are now
`Data/DataModelRecords.stx` (`mode="users|teams|subscribers"`), which hosts
`Models/ModelRecordsDashboard.stx` (stacksjs/stacks#3277). Change the columns,
labels, formats and actions on the model's `dashboard` block, not on the page.

The list takes four props when it is hosted: `model` (the slug, instead of the
last part of the address), `heading`, `description`, and `home` (where its
create, invite, view and edit links lead, so `/data/users/7` and not
`/models/user/7`). It has a `summary` slot above the search, where the page
puts its stat cards, and it emits `changed` after a delete, a bulk run that
did something, or one of the model's actions, so the page reads its numbers
again. The numbers come from the page's old endpoint asked for them alone:
`GET /api/dashboard/users?only=stats` reads no rows (`statsOnly(request)` in
`Data/data-records.ts`; `fetchDashboardStats(mode)` on the client).

Two stx behaviours shape this, and both fail silently:

- A prop bound by a parent client component is empty while the child is being
  set up and bound by the time it is mounted. The list's first load is in
  `onMount`; loaded sooner, it asked for a model named after the host's own
  address ("No ORM model named Users").
- What a page puts in another component's slot is read against that
  component's names first. A `page` in the hosting page was the list's page
  number and the first card read "Total undefined". The hosting page's names
  are deliberately its own (`recordsPage`, `pageStats`, `loadPageStats`);
  `tests/unit/dashboard-data-pages.test.ts` fails if one collides.

A status-like column (`status`, `role`, `state`, ... : `MODEL_BADGE_COLUMNS`)
is a pill in a list as it is on a record's page, both drawn by
`Models/ModelBadge.stx`. `modelBadgeTone(word)` colours it only when the word
says so: active, paid, published are positive; inactive, failed, cancelled
negative; pending, draft, queued pending; anything else (a role, a plan)
neutral. A field's own `format` still comes first (`modelCellDisplay`).

### How a model page loads

No model page draws a skeleton (the list, a record's page, its edit and create
forms, and the models overview). Three rules, the same on each:

- **It does not say it is loading at once.** `dashboardLoaderTimer(slow)` in
  `functions/dashboard-loading.ts` sets `slow` only after 250ms
  (`DASHBOARD_LOADER_DELAY`); call what it returns in `finally`. A page that
  answers at once never flashes a loader.
- **Before a first answer it is one quiet panel**, `UI/QuietLoader.stx`
  (`:slow`, `label`, `:framed="false"` inside a card), where the content will
  be. Nothing is known yet, so nothing is drawn that claims otherwise: no
  table, footer, count or empty state, a stat card reads `-` and never 0, and
  a heading is worded from the address (`modelNameFromSlug`) so "View User"
  does not start as "View Record".
- **Asked again, what is on the page stays**, dimmed and out of reach
  (`dashboardReloadingClass(loading(), base)` with `aria-busy`), and is
  swapped when the answer comes: a sort or a keystroke in the list, a record
  read again after one of its actions (its related panels stay too), Refresh
  on the overview.

Do not bring back placeholder rows or blocks. Before the columns are known
the list's were a lone bar each under "Actions" over a footer that said "No
records".

The Activity log is not a list of editable records and stays its own page.

### Users are invited, not typed in

`User.password` is required and hidden, so no form can supply it, and a
password typed by an operator would have to reach the person some other way.
When `User` allows `store`, its capability is `invite` instead of `create`:
the Users page and the model browser show "Invite user", which opens
`/data/users/invite` (name and email). `POST /api/dashboard/users/invitations`
creates the account with a random password nobody is shown and mails the
framework's account-setup link (`passwordResets(email).sendEmail({ purpose:
'setup' })`), valid for 7 days (`USER_INVITATION_DAYS`). The holder chooses
their password from that link; "Forgot password" works too if it expires.

An invitation whose mail could not be sent removes the account it created, so
a mail outage leaves no accounts whose holders were never told, and the retry
is not refused as a duplicate. An address that already has an account is
refused on the email field. Drop `store` from `dashboard.writes` to turn
inviting off.

## Application observability

HTTP capture is opt-in through `config/server.ts: captureRequests: true` (or
`{ enabled: true, exclude: ['/assets/*'] }`). Publish the native `Request` model
into the app schema and generate/migrate its table. Infrastructure-only overrides
can disable `useSeeder` and `useApi` and set `dashboard.access: false`; the guarded
Requests page and home metrics still use the private native schema inventory.

The recorder observes final responses in API dispatch and dev/production page
servers, including middleware refusals, 404s, and 405s. Proxied API traffic is
recorded by the API process once. Dashboard polling and framework assets are
excluded. It stores method, pathname, status, response-generation duration and
process heap usage, never bodies, headers or query parameters. Credential-bearing
path tails are redacted. IP and user-agent columns stay empty. Writes are buffered
with a 100-row pending limit; storage failures cannot replace HTTP responses.
`flushRequestCaptures()` from `@stacksjs/router/request-capture` drains the buffer;
API shutdown hooks call it. This is operational telemetry, not a delivery audit.

The standalone dashboard registers its guarded JSON API even when the application
skips default route bundles. Its STX state lives in
`storage/framework/runtime/dashboard-stx`, so opening it does not replace the
application's generated routes or layout types. It sits beside
`storage/framework/runtime/dashboard`, not inside it: that directory is watched,
and stx writes there on every render. Built-in module links follow
the native schema inventory, including private operational models.

The sidebar, model catalog and global search use the database's native model
scope: application overrides and discovered package models, with framework
models as a fallback. Global search uses the configured ORM connection on
PostgreSQL, SQLite and MySQL. Only stored, visible fields from `useSearch`
are queried; projected search-document fields are not assumed to be SQL columns.

`/search-engine` inspects the configured driver, provider indexes and model
`useSearch` settings, including custom index names. Provider failure leaves the
model inventory visible with an unavailable state. It never reindexes on a read.
`/jobs` discovers application definitions even before they have queued rows.
Definition import failures are operational failures, not a successful empty list.

Queue workers publish snapshots to the model-backed `queue_workers` table every
10 seconds and on graceful exit. Publish `QueueWorker` into an application's
model scope and generate/migrate its schema before using worker metrics. The
dashboard reads snapshots across processes. A heartbeat older than 60 seconds
marks the worker stopped and clears live throughput; sessions are retained for
seven days. Completion/failure totals describe those retained worker sessions,
not a durable per-job completion history. Declared job queues appear before
their first dispatch, and queues containing only failed jobs stay visible.
Database queue rows are authoritative for pending/reserved work.

The local error page reads `errors`. An Error model does not capture exceptions
by itself: configure `createDatabaseErrorReporter()` from
`@stacksjs/database/error-reporter` in `monitoring.reporters`, publish
`Error`, and migrate it. Reporting is bounded, buffered, identity-deduplicated
by `captureError`, and flushed by `flushErrorReporters`/the logger. The database
reporter stores allowlisted operational context and excludes bodies and headers.

### Pinned model rows

Declare `dashboard: { highlight: true }` on a model to pin its Data row, or use
numeric `highlight` values to order pinned rows. Other enabled Data models live
under the native Sidebar's collapsed More models disclosure. Labels, icons and
role gates apply to nested rows too. `enabled: false` omits navigation;
`access: false` excludes generic catalogs and reads as well.

### Personal sidebar order

Drag the grip on a section or item to reorder it. Focus a grip and press the
up/down arrow keys for the same operation. Items remain within their sibling
group, and moving a parent carries its descendants. Links, disclosure state,
role gates and model visibility remain owned by the shared Sidebar.

The guarded `GET|PUT /api/dashboard/sidebar-order` Actions persist identifiers
only in a machine-local file outside the checkout. `config/dashboard.ts` and
model `dashboard.highlight` values remain the team defaults. Reset order
restores the current defaults; new rows append in team order, and removed rows
cannot be resurrected by old preferences.

Files live under `$XDG_CONFIG_HOME/stacks/dashboard/`, or
`~/Library/Application Support/stacks/dashboard/` on macOS and
`~/.config/stacks/dashboard/` elsewhere. Canonical project-root and viewer
hashes isolate projects and authenticated users. The local developer dashboard
uses the local viewer. Writes are atomic and owner-readable; API reads are
private/no-store. These preferences survive framework upgrades and runtime
cache cleanup. They belong on the machine serving the dashboard, so browsers
and Craft windows connected to that project share the saved order.

The current Inbox SDK requires the S3 mailbox provider. Native IMAP/SMTP mail
servers do not publish Inbox/Mail Activity links; captured outgoing mail remains
available. Mail Settings requires the native MailPreference schema.
