import { route } from '@stacksjs/router'

// TODO: abstract the api prefix out of here
route.get('/api', () => 'hello world 1') // stacksjs.org/api
route.get('/api/', () => 'hello world 2') // stacksjs.org/api/
route.get('/api/welcome', () => 'hello world 3') // stacksjs.org/api/welcome
route.get('/api/welcome/', () => 'hello world 4') // stacksjs.org/api/welcome/

route.health() // /api/health
route.get('/api/buddy/commands', 'Buddy/CommandsAction')
route.get('/api/buddy/versions', 'Buddy/VersionsAction')
// route.job('/api/example') // the equivalent of route.get('/api/example', 'ExampleJob')
// route.get('/api/buddy-2', '../app/Actions/BuddyAction') // todo: support this
// route.get('/api/buddy-3', import('../app/Actions/BuddyAction')) // todo: support this

// route.group({ prefix: '/users' }, () => {
//   route.get('/:id', ({ id }) => {
//     // Retrieve user from database
//     return `User with ID ${id}`
//   })

//   route.post('/', ({ name, email }) => {
//     // Save user to database
//     return `User ${name} (${email}) created`
//   })
// })
