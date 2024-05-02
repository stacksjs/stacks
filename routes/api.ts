import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://stacksjs.org/docs/routing
 */

await route.get('/', () => 'hello world') // $APP_URL/api
await route.get('/hello/world', () => 'hello world, buddy') // stacksjs.org/api/hello/world
await route.get('/hello-world', () => {
  // $APP_URL/api/welcome
  return {
    // you may return an object as well
    data: 'hello world, friend',
  }
})

await route.email('/welcome')
await route.health() // adds an `/api/health` route

// await route.group('/some-path', async () => {...})
// await route.action('/example') // equivalent to `route.get('/example', 'ExampleAction')`
// await route.job('/example-two') // equivalent to `route.get('/example-two', 'ExampleTwoJob')`

