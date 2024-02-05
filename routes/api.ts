import { route } from '@stacksjs/router'

route.get('/api', () => 'hello world 1') // stacksjs.org/api
route.get('/api/', () => 'hello world 2') // stacksjs.org/api/
route.get('/api/welcome', () => 'hello world 3') // stacksjs.org/api/welcome
route.get('/api/welcome/', () => 'hello world 4') // stacksjs.org/api/welcome/
route.get('/api/health', () => 'healthy')

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
