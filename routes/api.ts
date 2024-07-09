import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://stacksjs.org/docs/routing
 */

await route.get('/foo/bar/{id}', () => 'hello world, foo bar') // stacksjs.org/api/hello/world
await route.get('/', () => 'hello world') // $APP_URL/api
await route.get('/hello/world', () => 'hello world, buddy') // stacksjs.org/api/hello/world

await route.post('/email/subscribe', 'Actions/SubscriberEmailAction')

await route.post('/login', 'Actions/LoginAction')

await route.email('/welcome')
await route.health() // adds an `/api/health` route

// await route.group('/some-path', async () => {...})
// await route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`

// await route.action('Dashboard/GetProjects')
// await route.action('Dashboard/Settings/UpdateAiConfig')

// await route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`
