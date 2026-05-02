import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's Buddy routes.
 * The routes defined here are automatically registered. Last but
 * not least, beware when deleting these pre-configured routes.
 *
 * @see https://stacksjs.com/docs/routing
 */

route.get('/versions', 'Actions/Buddy/VersionsAction') // your-domain.com/api/buddy/versions
route.get('/commands', 'Actions/Buddy/CommandsAction') // your-domain.com/api/buddy/commands

// Admin-dashboard backends. The existing dashboard/jobs/*.stx views
// expect these to exist; without them the dashboard renders empty
// states. They're under /api/buddy/* so the same auth gate that
// protects the rest of the buddy admin surface applies.
route.get('/jobs', 'Actions/Buddy/JobsListAction')
route.post('/jobs/{id}/retry', 'Actions/Buddy/JobRetryAction')
route.post('/jobs/{id}/cancel', 'Actions/Buddy/JobCancelAction')
route.get('/schedule', 'Actions/Buddy/ScheduleListAction')
