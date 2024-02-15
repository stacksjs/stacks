import { route } from '@stacksjs/router'

/**
 * This file is the entry point for your application's API routes.
 * The routes defined here are automatically registered. Last but
 * not least, you may also create any other `routes/*.ts` files.
 *
 * @see https://stacksjs.org/docs/routing
 */

route.get('/', () => 'hello world') // $APP_URL/api

route.get('/welcome', () => { // stacksjs.org/api/welcome
  return { // you may return an object as well
    data: 'hello world, friend',
  }
})

route.get('/hello/world', () => 'hello world, buddy') // stacksjs.org/api/hello/world

route.group('/buddy', () => { // you may group your routes in a few different ways
  route.get('/commands', 'Actions/Buddy/CommandsAction')

  route.group({ prefix: 'commands' }, () => {
    route.get('/example-two', import('Actions/Buddy/CommandsAction')) // or import the action directly
  })

  route.get('/versions', '../app/Actions/Buddy/VersionsAction') // a relative path is accepted as well
})

route.action('/example') // the equivalent of route.get('/example', 'ExampleAction')
route.job('/example-two') // the equivalent of route.get('/example-two', 'ExampleTwoJob')

route.health() // adds an `/api/health` route
