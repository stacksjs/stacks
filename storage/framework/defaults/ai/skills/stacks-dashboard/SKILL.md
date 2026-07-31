---
name: stacks-dashboard
description: Use when building or customizing the Stacks admin dashboard, including dashboard pages, model management views, analytics widgets, commerce dashboards, content management, settings panels, deployment monitoring, job/queue management, or the 250+ built-in dashboard components. Covers the dashboard system at storage/framework/defaults/.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Dashboard

The Stacks admin dashboard provides a full-featured admin panel with 100+ route views, 250+ components, and a multi-section layout.

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
`DeployScript`, and `LiveTerminalOutput`. Script reads and atomic writes use
`GET|PUT /api/dashboard/deployments/script`. The terminal uses
`GET /api/dashboard/deployments/terminal` and pauses polling while the document
is hidden. Do not create separate `/deployments/scripts` or
`/deployments/live-terminal` pages.

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

Use the shared `Dashboard/UI/Modal` and `Dashboard/UI/ConfirmDialog`
components when possible. A custom overlay root must use this shape:

```html
<div class="fixed inset-y-0 overflow-y-auto right-0 z-[55] dashboard-modal-layer">
  <button class="absolute inset-0" aria-label="Close dialog"></button>
  <!-- dialog panel -->
</div>
```

Do not solve sidebar overlap by increasing z-index alone. That places the
dialog above the sidebar without centering it in the available content area.
Keep overlay children `absolute`, not `fixed`, so they remain bounded by the
sidebar-aware root.

### Live dashboard audit

Start `./buddy dev --dashboard`, then run the dependency-free live audit from
the project root:

```bash
bun storage/framework/defaults/ai/skills/stacks-dashboard/scripts/audit.ts
# Or target a non-default origin:
bun storage/framework/defaults/ai/skills/stacks-dashboard/scripts/audit.ts --base-url http://127.0.0.1:3002
```

Pass a base URL as the first argument when the dashboard is not on
`http://127.0.0.1:3002`. The audit discovers route views, model destinations,
and representative parameterized pages. It requests every page as both a full
document and an `X-STX-Router` fragment, then crawls every registered GET
dashboard API. It fails on missing page renders, invalid fragment contracts,
empty or non-HTML pages, unresolved component tags, 5xx or method-mismatch
APIs, HTML API fallbacks, invalid JSON, and HTTP-200 error payloads.

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
