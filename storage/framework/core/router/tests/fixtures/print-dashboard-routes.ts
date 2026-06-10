/**
 * Subprocess fixture for dev-only-default-routes.test.ts (#1955).
 *
 * The /install + /test-error gate in defaults/routes/dashboard.ts is
 * evaluated at module-import time and bun caches modules per process,
 * so each APP_ENV scenario must run in a fresh process. Importing the
 * routes file registers into the router singleton as a side effect;
 * we then print a `METHOD path` snapshot as JSON on stdout.
 */

import { listRegisteredRoutes } from '@stacksjs/router'
import '../../../../defaults/routes/dashboard'

// eslint-disable-next-line no-console
console.log(JSON.stringify(listRegisteredRoutes().map(r => `${r.method} ${r.path}`)))
