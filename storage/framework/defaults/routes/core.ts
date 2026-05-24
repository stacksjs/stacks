import { route } from '@stacksjs/router'

/**
 * Framework routes shared by every Stacks app.
 *
 * User routes load first — defining the same path in `routes/web.ts` or
 * `routes/api.ts` overrides these defaults.
 */
route.get('/locale/{locale}', 'Actions/Locale/SetLocaleAction')
