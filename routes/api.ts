import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://stacksjs.org/docs/routing
 */

route.get('/', () => 'hello world') // stacksjs.org/api/
route.get('/welcome', () => 'hello world 2') // stacksjs.org/api/welcome
route.get('/welcome/', () => 'hello world 3') // stacksjs.org/api/welcome/
route.get('/buddy/commands', 'Buddy/CommandsAction')
route.get('/buddy/versions', 'Buddy/VersionsAction')
// route.get('/buddy/test-1', '../app/Actions/BuddyAction') // todo: support this
// route.get('/buddy/test-2', import('../app/Actions/BuddyAction')) // todo: support this

route.action('/example') // the equivalent of route.get('/example', 'ExampleAction')
route.job('/example-two') // the equivalent of route.get('/example-two', 'ExampleTwoJob')

route.health() // /api/health
