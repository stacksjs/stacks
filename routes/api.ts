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
await route.get('/buddy/versions', 'Actions/Buddy/VersionsAction') // stacksjs.org/api/buddy/versions
await route.get('/buddy/commands', 'Actions/Buddy/CommandsAction') // stacksjs.org/api/buddy/commands
await route.get('/welcome', () => { // $APP_URL/api/welcome
  return { // you may return an object as well
    data: 'hello world, friend',
  }
})

await route.health() // adds an `/api/health` route

// await route.group('/buddy', async () => { // you may group your routes in a few different ways
//   await route.get('/commands', 'Actions/Buddy/CommandsAction')

//   // nested groups are also supported
//   await route.group({ prefix: 'commands' }, async () => {
//     await route.get('/example-two', import('Actions/Buddy/CommandsAction')) // or import the action directly
//   })

//   await route.get('/versions', '../app/Actions/Buddy/VersionsAction') // a relative path is accepted as well
// })

// await route.action('/example') // the equivalent of route.get('/example', 'ExampleAction')
// await route.job('/example-two') // the equivalent of route.get('/example-two', 'ExampleTwoJob')
