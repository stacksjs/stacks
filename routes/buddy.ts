import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's Buddy routes.
 * The routes defined here are automatically registered. Last but
 * not least, beware when deleting these pre-configured routes.
 *
 * @see https://stacksjs.com/docs/routing
 */

route.get('/versions', 'Actions/Buddy/VersionsAction') // your-domain.com/api/buddy/versions

// Admin-dashboard backends, under /api/buddy/* so the same auth gate that
// protects the rest of the buddy admin surface applies. The job list itself
// is /api/dashboard/jobs.
route.post('/jobs/{id}/retry', 'Actions/Buddy/JobRetryAction')
route.post('/jobs/{id}/cancel', 'Actions/Buddy/JobCancelAction')
route.get('/schedule', 'Actions/Buddy/ScheduleListAction')
