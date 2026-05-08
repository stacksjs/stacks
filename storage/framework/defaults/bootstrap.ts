/**
 * Framework Bootstrap
 *
 * Single source of truth for which framework packages are wired into
 * boot. Each entry below either:
 *
 *   1. Imports a framework package whose `index.ts` self-registers via
 *      `route.register(...)` on import — analogous to the service
 *      provider pattern other frameworks (competitors) use to give
 *      packages a chance to wire themselves up at boot. This is the
 *      preferred shape for packages that own their own routes,
 *      migrations, etc.
 *
 *   2. Registers a framework routes file directly via `route.register()`
 *      — used when a routes file isn't yet wrapped in its own package.
 *
 * Adding a new framework package? Add a line here. There is no
 * filesystem scanning, no auto-discovery: this file is the entire
 * grep-able answer to "what does the framework load on boot?".
 *
 * @see storage/framework/core/router/src/route-loader.ts:loadFrameworkRoutes
 */

import { frameworkPath } from '@stacksjs/path'
import { route } from '@stacksjs/router'

// Dashboard, auth, password, email, etc. Currently lives as a single
// 687-line routes file under defaults/routes/dashboard.ts. As each
// subdomain grows it can split into smaller files (auth.ts, email.ts,
// commerce.ts) and each gets its own register() line — or moves into a
// dedicated workspace package whose index.ts self-registers.
await route.register(frameworkPath('defaults/routes/dashboard.ts'))
