import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's Buddy routes.
 * The routes defined here are automatically registered. Last but
 * not least, beware when deleting these pre-configured routes.
 *
 * @see https://stacksjs.org/docs/routing
 */

route.get('/versions', 'Actions/Buddy/VersionsAction') // your-domain.com/api/buddy/versions
route.get('/commands', 'Actions/Buddy/CommandsAction') // your-domain.com/api/buddy/commands
