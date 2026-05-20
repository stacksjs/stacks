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
 * No auth middleware is applied — these endpoints back the local dev
 * dashboard. If/when the dashboard is exposed beyond localhost, gate the
 * group with the appropriate middleware.
 */

import { route } from '@stacksjs/router'

route.group({ prefix: '/api/dashboard', apiResponse: true }, () => {
  route.get('/authors', 'Actions/Dashboard/Content/AuthorIndexAction')
  route.get('/posts', 'Actions/Dashboard/Content/PostIndexAction')
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
  // No auth/role middleware at the group level — the wider
  // `/api/dashboard` group is unauthenticated by design for the dev
  // dashboard's localhost use case (see the file-level comment).
  // The page itself wraps content in `useRole().isAdmin()` so the
  // surface stays gated client-side. Deployments that expose the
  // dashboard beyond localhost should tighten with
  // `.middleware('auth').middleware('role:admin')` here.
  route.get('/rbac/roles', 'Actions/Dashboard/Rbac/RolesIndexAction')
  route.post('/rbac/roles', 'Actions/Dashboard/Rbac/RoleStoreAction')
  route.delete('/rbac/roles/{name}', 'Actions/Dashboard/Rbac/RoleDestroyAction')

  route.get('/rbac/permissions', 'Actions/Dashboard/Rbac/PermissionsIndexAction')
  route.post('/rbac/permissions', 'Actions/Dashboard/Rbac/PermissionStoreAction')
  route.delete('/rbac/permissions/{name}', 'Actions/Dashboard/Rbac/PermissionDestroyAction')

  route.get('/rbac/users', 'Actions/Dashboard/Rbac/UsersListAction')
  route.get('/rbac/users/{id}/roles', 'Actions/Dashboard/Rbac/UserRolesShowAction')
  route.post('/rbac/users/{id}/roles', 'Actions/Dashboard/Rbac/UserRolesSyncAction')

  route.get('/rbac/roles/{name}/permissions', 'Actions/Dashboard/Rbac/RolePermissionsShowAction')
  route.post('/rbac/roles/{name}/permissions', 'Actions/Dashboard/Rbac/RolePermissionsSyncAction')
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

  // Models overview. Walks `app/Models/` + framework default models,
  // counts rows for each, returns grouped JSON for the
  // `views/dashboard/models/index.stx` page (stacksjs/stacks#1838).
  route.get('/models', 'Actions/Dashboard/Models/ModelsIndexAction')

  // Per-model row view — first 50 rows + column list, for the
  // dynamic `views/dashboard/models/[model].stx` page. ORM path
  // first, raw SQLite fallback if no model file matches the slug.
  route.get('/models/{slug}', 'Actions/Dashboard/Models/ModelShowAction')
})
