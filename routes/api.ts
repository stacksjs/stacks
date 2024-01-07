// the only difference between web and api routes is that the API middleware is associated by default
import { route } from '@stacksjs/router'

route.get('/', () => 'hello world 1')
route.get('/api/', () => 'hello world 2')
route.get('/api/welcome', () => 'hello world 3')
route.get('/welcome', () => 'hello world 4')

// route.group({ prefix: '/users' }, () => {
//   route.before(async (params) => {
//     console.log(`[${now()}] ${params.method} ${params.url}`)
//   })

//   route.get('/:id', ({ id }) => {
//     // Retrieve user from database
//     return `User with ID ${id}`
//   })

//   route.post('/', ({ name, email }) => {
//     // Save user to database
//     return `User ${name} (${email}) created`
//   })
// })
