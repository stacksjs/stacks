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
})
