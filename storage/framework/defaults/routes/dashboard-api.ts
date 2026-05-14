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

route.group({ prefix: '/api/dashboard' }, () => {
  route.get('/authors', 'Actions/Dashboard/Content/AuthorIndexAction')
  route.get('/posts', 'Actions/Dashboard/Content/PostIndexAction')
})
