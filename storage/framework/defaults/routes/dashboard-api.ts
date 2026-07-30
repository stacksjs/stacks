/**
 * Dashboard API Routes
 *
 * JSON endpoints under `/api/dashboard/*` that the dev dashboard UI fetches
 * from. Kept separate from `defaults/routes/dashboard.ts` (which mounts the
 * STX views, auth flows, email subscribe, etc.) so the data layer for the
 * dashboard has one obvious file to grep.
 *
 * Registered in `defaults/bootstrap.ts`. The dev dashboard server delegates
 * `/api/dashboard/*` requests to the Stacks router; user-defined routes in
 * `routes/api.ts` still take priority because they load first.
 *
 * Routes that mutate data or expose unpublished content are wrapped in
 * `guard()` (see below): a no-op locally so the dev dashboard works without a
 * token, `auth` + `role:admin` everywhere else. The remaining reads are
 * unauthenticated by design.
 */

import { route } from '@stacksjs/router'

// The `/api/dashboard/*` surface is unauthenticated by design for the local
// dev dashboard (which gates content client-side via `useRole()`). Client-side
// gating is no protection for a JSON API, so once the dashboard is reachable
// off localhost the privilege-bearing endpoints — RBAC role/permission writes
// (assign-any-role-to-any-user = privilege escalation) and the model-row dump
// (arbitrary DB read) — must be gated server-side. In a local/dev/test env the
// guard is a no-op so the dev dashboard keeps working without a token.
const APP_ENV = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()
const IS_LOCAL_ENV = APP_ENV === '' || APP_ENV === 'local' || APP_ENV === 'development' || APP_ENV === 'dev' || APP_ENV === 'test' || APP_ENV === 'testing'

// Apply auth + admin-role middleware to a sensitive route outside local envs.
// Returns the route builder so calls read as `guard(route.post(...))`.
function guard(r: any): any {
  if (!IS_LOCAL_ENV)
    r.middleware('auth').middleware('role:admin')
  return r
}

route.group({ prefix: '/api/dashboard', apiResponse: true }, () => {
  guard(route.get('/home', 'Actions/Dashboard/DashboardHomeAction'))
  guard(route.get('/requests', 'Actions/Dashboard/Infrastructure/RequestIndexAction'))
  guard(route.get('/source/actions', 'Actions/Dashboard/Actions/GetActions'))
  guard(route.get('/source/commands', 'Actions/Dashboard/Infrastructure/CommandIndexAction'))

  guard(route.get('/analytics/web', 'Actions/Dashboard/Analytics/WebAnalyticsAction'))
  guard(route.get('/analytics/sales', 'Actions/Dashboard/Analytics/SalesAnalyticsAction'))
  guard(route.get('/analytics/marketing', 'Actions/Dashboard/Analytics/MarketingAnalyticsAction'))
  guard(route.get('/analytics/events', 'Actions/Dashboard/Analytics/EventAnalyticsAction'))
  guard(route.post('/analytics/events', 'Actions/Dashboard/Analytics/EventStoreAction'))
  guard(route.get('/buddy/chat', 'Actions/Dashboard/Buddy/BuddyChatStateAction'))
  guard(route.post('/buddy/chat', 'Actions/Dashboard/Buddy/BuddyChatAction'))
  guard(route.post('/buddy/chat/clear', 'Actions/Dashboard/Buddy/BuddyChatClearAction'))
  guard(route.get('/jobs', 'Actions/Dashboard/Jobs/JobIndexAction'))
  guard(route.get('/jobs/stats', 'Actions/Dashboard/Jobs/JobStatsAction'))
  guard(route.get('/jobs/{id}', 'Actions/Dashboard/Jobs/JobShowAction'))
  guard(route.post('/jobs/{id}/retry', 'Actions/Dashboard/Jobs/JobRetryAction'))
  guard(route.get('/queue/stats', 'Actions/Dashboard/Queue/QueueStatsAction'))
  guard(route.get('/queue/workers', 'Actions/Dashboard/Queue/QueueWorkersAction'))
  guard(route.post('/queue/retry-failed', 'Actions/Dashboard/Queue/QueueRetryFailedAction'))
  guard(route.get('/realtime', 'Actions/Dashboard/Realtime/RealtimeStatsAction'))
  guard(route.get('/releases', 'Actions/Dashboard/Releases/ReleaseIndexAction'))
  guard(route.get('/library/dependencies', 'Actions/Dashboard/Library/DependencyIndexAction'))
  guard(route.get('/library/packages', 'Actions/Dashboard/Library/PackageIndexAction'))
  guard(route.get('/library/functions', 'Actions/Dashboard/Library/GetFunctions'))
  guard(route.post('/library/functions', 'Actions/Dashboard/Library/CreateFunction'))
  guard(route.get('/library/components', 'Actions/Dashboard/Library/GetComponents'))
  guard(route.post('/library/components', 'Actions/Dashboard/Library/CreateComponent'))
  guard(route.get('/commerce/waitlist-products', 'Actions/Dashboard/Commerce/ProductWaitlistIndexAction'))
  guard(route.get('/commerce/waitlist-restaurants', 'Actions/Dashboard/Commerce/RestaurantWaitlistIndexAction'))
  guard(route.get('/commerce/reviews', 'Actions/Dashboard/Commerce/ReviewIndexAction'))
  guard(route.get('/commerce/coupons', 'Actions/Dashboard/Commerce/CommerceCouponsAction'))
  guard(route.get('/commerce/gift-cards', 'Actions/Dashboard/Commerce/CommerceGiftCardsAction'))
  guard(route.get('/commerce/categories', 'Actions/Dashboard/Commerce/CommerceCategoriesAction'))
  guard(route.get('/commerce/customers', 'Actions/Dashboard/Commerce/CommerceCustomersAction'))
  guard(route.get('/commerce/orders', 'Actions/Dashboard/Commerce/CommerceOrdersAction'))
  guard(route.get('/commerce/pos', 'Actions/Dashboard/Commerce/CommercePosAction'))
  guard(route.post('/commerce/pos/checkout', 'Actions/Dashboard/Commerce/CommercePosCheckoutAction'))
  guard(route.get('/commerce/products', 'Actions/Dashboard/Commerce/CommerceProductsAction'))
  guard(route.get('/commerce/products/{id}', 'Actions/Dashboard/Commerce/CommerceProductDetailAction'))
  guard(route.get('/commerce/manufacturers', 'Actions/Dashboard/Commerce/ManufacturerIndexAction'))
  guard(route.get('/commerce/units', 'Actions/Dashboard/Commerce/ProductUnitIndexAction'))
  guard(route.patch('/commerce/units/{id}/default', 'Actions/Dashboard/Commerce/ProductUnitDefaultAction'))
  guard(route.get('/commerce/taxes', 'Actions/Dashboard/Commerce/CommerceTaxesAction'))
  guard(route.patch('/commerce/taxes/{id}/default', 'Actions/Dashboard/Commerce/TaxRateDefaultAction'))
  guard(route.get('/commerce/variants', 'Actions/Dashboard/Commerce/ProductVariantIndexAction'))
  guard(route.get('/commerce/payments', 'Actions/Dashboard/Commerce/CommercePaymentsAction'))
  guard(route.post('/commerce/payments/{id}/refund', 'Actions/Dashboard/Commerce/PaymentRefundAction'))
  guard(route.get('/commerce/print-devices', 'Actions/Dashboard/Commerce/CommercePrintDevicesAction'))
  guard(route.get('/commerce/print-logs', 'Actions/Dashboard/Commerce/CommercePrintLogsAction'))
  guard(route.get('/deployments', 'Actions/Dashboard/Deployments/GetDeployments'))
  guard(route.post('/deployments', 'Actions/Dashboard/Deployments/CreateDeployment'))
  guard(route.get('/deployments/count', 'Actions/Dashboard/Deployments/GetDeploymentCount'))
  guard(route.get('/deployments/recent', 'Actions/Dashboard/Deployments/GetRecentDeployments'))
  guard(route.get('/deployments/avg-time', 'Actions/Dashboard/Deployments/GetAverageDeploymentTime'))
  guard(route.get('/deployments/script', 'Actions/Dashboard/Deployments/GetDeployScript'))
  guard(route.put('/deployments/script', 'Actions/Dashboard/Deployments/UpdateDeployScript'))
  guard(route.get('/deployments/terminal', 'Actions/Dashboard/Deployments/GetDeploymentLiveTerminalOutput'))
  guard(route.get('/deployments/{id}', 'Actions/Dashboard/Deployments/GetDeployment'))
  guard(route.get('/data/activity', 'Actions/Dashboard/Data/ActivityIndexAction'))
  guard(route.get('/data/users', 'Actions/Dashboard/Data/UserIndexAction'))
  guard(route.get('/data/teams', 'Actions/Dashboard/Data/TeamIndexAction'))
  guard(route.get('/data/subscribers', 'Actions/Dashboard/Data/SubscriberIndexAction'))

  // CMS admin — backs the pages under `views/dashboard/content/`.
  //
  // This is the dashboard-reachable surface for CMS CRUD. The `/cms/*` group in
  // `defaults/routes/dashboard.ts` is the public authoring API and is NOT usable
  // from here: the dev dashboard server only delegates `/api/*` to the Stacks
  // router on GET (a GET `/cms/posts` renders the STX 404 page instead), and
  // that group is `middleware: 'auth'` while the dashboard server runs with
  // `auth: false` and sends no credentials.
  //
  // Guarded for the same reason as the blog routes below: the writes mutate the
  // database and the reads expose unpublished drafts and unmoderated comments.
  guard(route.get('/posts', 'Actions/Dashboard/Content/PostIndexAction'))
  guard(route.post('/posts', 'Actions/Dashboard/Content/PostStoreAction'))
  guard(route.patch('/posts/{id}', 'Actions/Dashboard/Content/PostUpdateAction'))
  guard(route.delete('/posts/{id}', 'Actions/Dashboard/Content/PostDestroyAction'))

  guard(route.get('/authors', 'Actions/Dashboard/Content/AuthorIndexAction'))
  guard(route.post('/authors', 'Actions/Dashboard/Content/AuthorStoreAction'))
  guard(route.patch('/authors/{id}', 'Actions/Dashboard/Content/AuthorUpdateAction'))
  guard(route.delete('/authors/{id}', 'Actions/Dashboard/Content/AuthorDestroyAction'))

  guard(route.get('/categories', 'Actions/Dashboard/Content/CategoryIndexAction'))
  guard(route.post('/categories', 'Actions/Dashboard/Content/CategoryStoreAction'))
  guard(route.delete('/categories/{id}', 'Actions/Dashboard/Content/CategoryDestroyAction'))

  guard(route.get('/tags', 'Actions/Dashboard/Content/TagIndexAction'))
  guard(route.post('/tags', 'Actions/Dashboard/Content/TagStoreAction'))
  guard(route.delete('/tags/{id}', 'Actions/Dashboard/Content/TagDestroyAction'))

  guard(route.get('/pages', 'Actions/Dashboard/Content/PageIndexAction'))
  guard(route.post('/pages', 'Actions/Dashboard/Content/PageStoreAction'))
  guard(route.patch('/pages/{id}', 'Actions/Dashboard/Content/PageUpdateAction'))
  guard(route.delete('/pages/{id}', 'Actions/Dashboard/Content/PageDestroyAction'))

  // No store route: comments arrive from readers, the dashboard only moderates.
  guard(route.get('/comments', 'Actions/Dashboard/Content/CommentIndexAction'))
  guard(route.patch('/comments/{id}', 'Actions/Dashboard/Content/CommentUpdateAction'))
  guard(route.delete('/comments/{id}', 'Actions/Dashboard/Content/CommentDestroyAction'))

  route.get('/ci/status', 'Actions/Dashboard/Ci/StatusAction')
  // CI drilldown (stacksjs/stacks#1848): per-repo run history + per-run
  // job detail. On-demand reads so the polled snapshot stays cheap.
  // `name` is the URL-meaningful identifier here; bun-router segments
  // route on per-param basis so the `runs/{runId}/jobs` form doesn't
  // conflict with the `runs?limit=N` collection form.
  route.get('/ci/repos/{owner}/{name}/runs', 'Actions/Dashboard/Ci/RepoRunsAction')
  route.get('/ci/repos/{owner}/{name}/runs/{runId}/jobs', 'Actions/Dashboard/Ci/RepoRunJobsAction')
  // Runner-pressure history for the sparkline (stacksjs/stacks#1850).
  // Only useful when `ci.alerts.enabled` is on — otherwise no samples
  // have been recorded.
  route.get('/ci/runner-history', 'Actions/Dashboard/Ci/RunnerHistoryAction')

  // RBAC management surface (stacksjs/stacks#1845).
  //
  // These endpoints can assign any role to any user (privilege
  // escalation) and enumerate users, so they are wrapped in `guard()`:
  // unauthenticated in local/dev (the dashboard gates client-side via
  // `useRole().isAdmin()`), but `auth` + `role:admin` enforced server-side
  // in every non-local env (see the guard definition at the top of file).
  guard(route.get('/rbac/roles', 'Actions/Dashboard/Rbac/RolesIndexAction'))
  guard(route.post('/rbac/roles', 'Actions/Dashboard/Rbac/RoleStoreAction'))
  guard(route.delete('/rbac/roles/{name}', 'Actions/Dashboard/Rbac/RoleDestroyAction'))

  guard(route.get('/rbac/permissions', 'Actions/Dashboard/Rbac/PermissionsIndexAction'))
  guard(route.post('/rbac/permissions', 'Actions/Dashboard/Rbac/PermissionStoreAction'))
  guard(route.delete('/rbac/permissions/{name}', 'Actions/Dashboard/Rbac/PermissionDestroyAction'))

  guard(route.get('/rbac/users', 'Actions/Dashboard/Rbac/UsersListAction'))
  guard(route.get('/rbac/users/{id}/roles', 'Actions/Dashboard/Rbac/UserRolesShowAction'))
  guard(route.post('/rbac/users/{id}/roles', 'Actions/Dashboard/Rbac/UserRolesSyncAction'))

  guard(route.get('/rbac/roles/{name}/permissions', 'Actions/Dashboard/Rbac/RolePermissionsShowAction'))
  guard(route.post('/rbac/roles/{name}/permissions', 'Actions/Dashboard/Rbac/RolePermissionsSyncAction'))
  // RBAC identity endpoint (stacksjs/stacks#1843). Returns the
  // authenticated user + their role names so the dashboard's `useRole()`
  // composable can gate dev-mode surfaces. Tolerates unauthenticated
  // requests — see the action for the soft-fallback shape.
  route.get('/auth/me', 'Actions/Dashboard/Auth/MeAction')

  // Kanban surface (stacksjs/stacks#1846). Phase 1: read-only.
  //
  // Phase 2 lands write endpoints under the same prefix:
  //   POST   /kanban/boards           — store
  //   PATCH  /kanban/boards/{id}      — update
  //   DELETE /kanban/boards/{id}      — destroy
  //   POST   /kanban/boards/reorder   — bulk position update
  //   POST   /kanban/columns          — store
  //   PATCH  /kanban/columns/{id}     — update
  //   POST   /kanban/columns/reorder  — bulk position update
  //   POST   /kanban/cards            — store
  //   PATCH  /kanban/cards/{id}       — update (incl. column move)
  //   POST   /kanban/cards/reorder    — bulk position update
  //
  // No role middleware applied yet — the route group at the file level
  // doesn't enforce auth (matches the rest of /api/dashboard/*). The
  // page itself wraps content in `useRole().isDev()` so non-dev users
  // see an empty surface when the dashboard ever gets exposed beyond
  // localhost. Tighten with `.middleware('auth').middleware('role:admin,dev')`
  // when the dashboard is deployed multi-tenant.
  // Reads (Phase 1)
  route.get('/kanban/boards', 'Actions/Dashboard/Kanban/BoardsIndexAction')
  route.get('/kanban/boards/{id}', 'Actions/Dashboard/Kanban/BoardShowAction')

  // Writes (Phase 2). The reorder endpoints are POST not PATCH because
  // their semantics — "here's the full new state of this slice of the
  // board" — match the resource-replacement intent better than PATCH's
  // "apply this delta" verb. They also accept a body shape that PATCH
  // verbs don't conventionally carry.
  route.post('/kanban/boards', 'Actions/Dashboard/Kanban/BoardStoreAction')
  route.patch('/kanban/boards/{id}', 'Actions/Dashboard/Kanban/BoardUpdateAction')
  route.delete('/kanban/boards/{id}', 'Actions/Dashboard/Kanban/BoardDestroyAction')
  route.post('/kanban/boards/reorder', 'Actions/Dashboard/Kanban/BoardsReorderAction')

  route.post('/kanban/columns', 'Actions/Dashboard/Kanban/ColumnStoreAction')
  route.patch('/kanban/columns/{id}', 'Actions/Dashboard/Kanban/ColumnUpdateAction')
  route.delete('/kanban/columns/{id}', 'Actions/Dashboard/Kanban/ColumnDestroyAction')
  route.post('/kanban/columns/reorder', 'Actions/Dashboard/Kanban/ColumnsReorderAction')

  route.post('/kanban/cards', 'Actions/Dashboard/Kanban/CardStoreAction')
  route.patch('/kanban/cards/{id}', 'Actions/Dashboard/Kanban/CardUpdateAction')
  route.delete('/kanban/cards/{id}', 'Actions/Dashboard/Kanban/CardDestroyAction')
  route.post('/kanban/cards/reorder', 'Actions/Dashboard/Kanban/CardsReorderAction')

  // Phase 3 — card detail + labels + assignees + comments.
  //
  // The card-show endpoint is the only "single card with everything"
  // read; the boards/{id} response already embeds labels + assignees
  // per card for the kanban view, so the modal only fetches when
  // opening (or for direct URL access).
  route.get('/kanban/cards/{id}', 'Actions/Dashboard/Kanban/CardShowAction')

  // Label CRUD. No reorder endpoint — labels are board-scoped tag
  // palettes, no inherent order beyond alphabetical.
  route.post('/kanban/labels', 'Actions/Dashboard/Kanban/LabelStoreAction')
  route.patch('/kanban/labels/{id}', 'Actions/Dashboard/Kanban/LabelUpdateAction')
  route.delete('/kanban/labels/{id}', 'Actions/Dashboard/Kanban/LabelDestroyAction')

  // Card-pivot sync endpoints. Sync semantics: pass the full new
  // list, the action diffs against current state. Single-shot calls
  // from the modal's label/assignee pickers.
  route.post('/kanban/cards/{id}/labels', 'Actions/Dashboard/Kanban/CardLabelsSyncAction')
  route.post('/kanban/cards/{id}/assignees', 'Actions/Dashboard/Kanban/CardAssigneesSyncAction')

  // Comments. Append-only thread: store + destroy, no edit yet — the
  // history-preservation argument outweighs the "fix a typo" argument
  // until someone explicitly asks for editing.
  route.post('/kanban/cards/{id}/comments', 'Actions/Dashboard/Kanban/CardCommentStoreAction')
  route.delete('/kanban/comments/{id}', 'Actions/Dashboard/Kanban/CardCommentDestroyAction')

  // Lightweight user list for the assignee picker. Distinct from the
  // wider `/api/dashboard/users` (Data section consumer) — the
  // picker only needs id/name/email.
  route.get('/kanban/users', 'Actions/Dashboard/Kanban/UsersListAction')

  // Commerce dashboard stats. Same Action that backs the auth'd
  // `/api/commerce/dashboard` — exposed here without the auth gate so
  // the dev-mode dashboard surface in `views/dashboard/commerce/dashboard/`
  // can load it directly. The page itself stays admin-gated via
  // `useRole().isAdmin()` (stacksjs/stacks#1838).
  route.get('/commerce/stats', 'Actions/Dashboard/Commerce/CommerceDashboardAction')

  // Delivery operations overview. Guarded because route and driver data is
  // operational information even though the underlying models expose their
  // own generated useApi endpoints.
  guard(route.get('/commerce/delivery', 'Actions/Dashboard/Commerce/CommerceDeliveryAction'))

  // Dashboard-local aliases for the model-backed delivery resources. These
  // reuse the same commerce Actions as the authenticated public API while the
  // local guard keeps `buddy dev --dashboard` usable without a login session.
  guard(route.get('/commerce/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodIndexAction'))
  guard(route.get('/commerce/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodShowAction'))
  guard(route.post('/commerce/shipping-methods', 'Actions/Commerce/Shipping/ShippingMethodStoreAction'))
  guard(route.patch('/commerce/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodUpdateAction'))
  guard(route.delete('/commerce/shipping-methods/{id}', 'Actions/Commerce/Shipping/ShippingMethodDestroyAction'))

  guard(route.get('/commerce/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateIndexAction'))
  guard(route.get('/commerce/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateShowAction'))
  guard(route.post('/commerce/shipping-rates', 'Actions/Commerce/Shipping/ShippingRateStoreAction'))
  guard(route.patch('/commerce/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateUpdateAction'))
  guard(route.delete('/commerce/shipping-rates/{id}', 'Actions/Commerce/Shipping/ShippingRateDestroyAction'))

  guard(route.get('/commerce/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneIndexAction'))
  guard(route.get('/commerce/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneShowAction'))
  guard(route.post('/commerce/shipping-zones', 'Actions/Commerce/Shipping/ShippingZoneStoreAction'))
  guard(route.patch('/commerce/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneUpdateAction'))
  guard(route.delete('/commerce/shipping-zones/{id}', 'Actions/Commerce/Shipping/ShippingZoneDestroyAction'))

  guard(route.get('/commerce/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteIndexAction'))
  guard(route.get('/commerce/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteShowAction'))
  guard(route.post('/commerce/delivery-routes', 'Actions/Commerce/Shipping/DeliveryRouteStoreAction'))
  guard(route.patch('/commerce/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteUpdateAction'))
  guard(route.delete('/commerce/delivery-routes/{id}', 'Actions/Commerce/Shipping/DeliveryRouteDestroyAction'))

  guard(route.get('/commerce/drivers', 'Actions/Commerce/Shipping/DriverIndexAction'))
  guard(route.get('/commerce/drivers/{id}', 'Actions/Commerce/Shipping/DriverShowAction'))
  guard(route.post('/commerce/drivers', 'Actions/Commerce/Shipping/DriverStoreAction'))
  guard(route.patch('/commerce/drivers/{id}', 'Actions/Commerce/Shipping/DriverUpdateAction'))
  guard(route.delete('/commerce/drivers/{id}', 'Actions/Commerce/Shipping/DriverDestroyAction'))

  guard(route.get('/commerce/digital-deliveries', 'Actions/Commerce/Shipping/DigitalDeliveryIndexAction'))
  guard(route.get('/commerce/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryShowAction'))
  guard(route.post('/commerce/digital-deliveries', 'Actions/Commerce/Shipping/DigitalDeliveryStoreAction'))
  guard(route.patch('/commerce/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryUpdateAction'))
  guard(route.delete('/commerce/digital-deliveries/{id}', 'Actions/Commerce/Shipping/DigitalDeliveryDestroyAction'))

  guard(route.get('/commerce/license-keys', 'Actions/Dashboard/Commerce/LicenseKeyIndexAction'))
  guard(route.get('/commerce/license-key-options', 'Actions/Dashboard/Commerce/LicenseKeyOptionsAction'))
  guard(route.get('/commerce/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyShowAction'))
  guard(route.post('/commerce/license-keys', 'Actions/Commerce/Shipping/LicenseKeyStoreAction'))
  guard(route.patch('/commerce/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyUpdateAction'))
  guard(route.delete('/commerce/license-keys/{id}', 'Actions/Commerce/Shipping/LicenseKeyDestroyAction'))

  guard(route.get('/marketing/lists', 'Actions/Dashboard/Marketing/ListIndexAction'))
  guard(route.post('/marketing/lists', 'Actions/Dashboard/Marketing/ListStoreAction'))
  guard(route.patch('/marketing/lists/{id}', 'Actions/Dashboard/Marketing/ListUpdateAction'))
  guard(route.delete('/marketing/lists/{id}', 'Actions/Dashboard/Marketing/ListDestroyAction'))
  guard(route.get('/marketing/campaigns', 'Actions/Dashboard/Marketing/CampaignIndexAction'))
  guard(route.post('/marketing/campaigns', 'Actions/Dashboard/Marketing/CampaignStoreAction'))
  guard(route.patch('/marketing/campaigns/{id}', 'Actions/Dashboard/Marketing/CampaignUpdateAction'))
  guard(route.delete('/marketing/campaigns/{id}', 'Actions/Dashboard/Marketing/CampaignDestroyAction'))
  guard(route.post('/marketing/campaigns/{id}/send', 'Actions/Dashboard/Marketing/CampaignSendAction'))
  guard(route.post('/marketing/campaigns/{id}/schedule', 'Actions/Dashboard/Marketing/CampaignScheduleAction'))
  guard(route.post('/marketing/campaigns/{id}/cancel', 'Actions/Dashboard/Marketing/CampaignCancelAction'))
  guard(route.get('/marketing/social-posts', 'Actions/Dashboard/Marketing/SocialPostIndexAction'))
  guard(route.post('/marketing/social-posts', 'Actions/Dashboard/Marketing/SocialPostStoreAction'))
  guard(route.patch('/marketing/social-posts/{id}', 'Actions/Dashboard/Marketing/SocialPostUpdateAction'))
  guard(route.delete('/marketing/social-posts/{id}', 'Actions/Dashboard/Marketing/SocialPostDestroyAction'))

  guard(route.get('/notification-deliveries', 'Actions/Dashboard/Notifications/NotificationDeliveryIndexAction'))
  guard(route.get('/notification-deliveries/overview', 'Actions/Dashboard/Notifications/NotificationDeliveryOverviewAction'))
  guard(route.get('/notification-deliveries/history', 'Actions/Dashboard/Notifications/NotificationDeliveryHistoryAction'))
  guard(route.post('/notification-deliveries/{id}/retry', 'Actions/Dashboard/Notifications/NotificationDeliveryRetryAction'))

  // Models overview. Walks `app/Models/` + framework default models,
  // counts rows for each, returns grouped JSON for the
  // `views/dashboard/models/index.stx` page (stacksjs/stacks#1838).
  guard(route.get('/models', 'Actions/Dashboard/Models/ModelsIndexAction'))

  // Per-model row query for the dynamic `views/dashboard/models/[model].stx`
  // page: paging, sorting, search and column filters, all resolved
  // server-side. ORM path first, raw SQLite fallback if no model file
  // matches the slug.
  guard(route.get('/models/{slug}', 'Actions/Dashboard/Models/ModelShowAction'))

  // Row writes from the same page. Guarded like every other mutating
  // dashboard endpoint; models with no ORM file stay read-only, which the
  // actions enforce rather than the route.
  guard(route.patch('/models/{slug}/{id}', 'Actions/Dashboard/Models/ModelUpdateAction'))
  guard(route.delete('/models/{slug}/{id}', 'Actions/Dashboard/Models/ModelDestroyAction'))

  // Error monitoring - the same native Error model aggregation exposed by
  // the token-authenticated `/api/monitoring` routes, projected through the
  // dashboard guard so the local dashboard session can read and manage it.
  guard(route.get('/monitoring/errors', 'Actions/Monitoring/ErrorIndexAction'))
  guard(route.get('/monitoring/errors/stats', 'Actions/Monitoring/ErrorStatsAction'))
  guard(route.get('/monitoring/errors/timeline', 'Actions/Monitoring/ErrorTimelineAction'))
  guard(route.get('/monitoring/errors/group', 'Actions/Monitoring/ErrorGroupAction'))
  guard(route.get('/monitoring/errors/{id}', 'Actions/Monitoring/ErrorShowAction'))
  guard(route.patch('/monitoring/errors/resolve', 'Actions/Monitoring/ErrorResolveAction'))
  guard(route.patch('/monitoring/errors/ignore', 'Actions/Monitoring/ErrorIgnoreAction'))
  guard(route.patch('/monitoring/errors/unresolve', 'Actions/Monitoring/ErrorUnresolveAction'))
  guard(route.delete('/monitoring/errors', 'Actions/Monitoring/ErrorDestroyAction'))

  guard(route.get('/queries', 'Actions/Dashboard/Queries/QueryDashboardAction'))
  guard(route.get('/queries/{id}', 'Actions/Dashboard/Queries/QueryShowAction'))

  // Markdown blog admin — the write side of the BunPress blog that /blog
  // renders from `content/blog/*.md` (storage/framework/core/actions/src/blog.ts).
  // Backs `views/dashboard/content/blog/index.stx`.
  //
  // Every route is guarded: the writes put files on disk, and the reads expose
  // unpublished drafts. Neither belongs on an unauthenticated endpoint once the
  // dashboard is reachable off localhost.
  guard(route.get('/blog', 'Actions/Blog/BlogIndexAction'))
  guard(route.get('/blog/{slug}', 'Actions/Blog/BlogShowAction'))
  guard(route.post('/blog', 'Actions/Blog/BlogStoreAction'))
  guard(route.patch('/blog/{slug}', 'Actions/Blog/BlogUpdateAction'))
  guard(route.delete('/blog/{slug}', 'Actions/Blog/BlogDestroyAction'))

  // Email inbox — real inbound mailbox data from S3.
  //
  // Reads expose recipient/subject metadata; the mark-read endpoint mutates
  // the per-mailbox inbox.json index. Both are guarded outside local/dev
  // because they touch real mailbox state and PII.
  guard(route.get('/email/inbox', 'Actions/Dashboard/Email/InboxIndexAction'))
  guard(route.get('/email/inbox/{id}', 'Actions/Dashboard/Email/InboxShowAction'))
  guard(route.get('/email/stats', 'Actions/Dashboard/Email/InboxStatsAction'))
  guard(route.get('/email/activity', 'Actions/Dashboard/Email/InboxActivityAction'))
  guard(route.get('/email/preferences', 'Actions/Dashboard/Email/InboxPreferenceShowAction'))
  guard(route.put('/email/preferences', 'Actions/Dashboard/Email/InboxPreferenceUpdateAction'))
  guard(route.post('/email/send', 'Actions/Dashboard/Email/InboxSendAction'))
  guard(route.post('/email/read', 'Actions/Dashboard/Email/InboxMarkReadAction'))
  guard(route.post('/email/unread', 'Actions/Dashboard/Email/InboxMarkUnreadAction'))
  guard(route.delete('/email/inbox/{id}', 'Actions/Dashboard/Email/InboxDeleteAction'))
})
