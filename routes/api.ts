import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://docs.stacksjs.org/routing
 */

route.get('/foo/bar/{id}', () => 'hello world, foo bar') // $APP_URL/api/hello/world
route.get('/', () => 'hello world') // $APP_URL/api
route.get('/hello/world', () => 'hello world, buddy') // $APP_URL/api/hello/world

route.post('/email/subscribe', 'Actions/SubscriberEmailAction')
route.post('/login', 'Actions/LoginAction')

// route.email('/welcome')
route.health() // adds a GET `/api/health` route
route.get('/install', 'Actions/InstallAction')
route.post('/ai/ask', 'Actions/AI/AskAction')
route.post('/ai/summary', 'Actions/AI/SummaryAction')

// route.group('/some-path', async () => {...})
// route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`
// route.action('Dashboard/GetProjects')
// route.action('Dashboard/Settings/UpdateAiConfig')
// route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`
