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
  route.get('/kanban/boards', 'Actions/Dashboard/Kanban/BoardsIndexAction')
  route.get('/kanban/boards/{id}', 'Actions/Dashboard/Kanban/BoardShowAction')
})
