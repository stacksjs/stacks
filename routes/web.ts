// import { route } from '@stacksjs/router'

// route.get('/', () => {
//   return 'Hello, world!'
// })

// route.view('/welcome', 'welcome')

// import CreateUser from './resources/functions/api/CreateUser'

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

// route.post('createPaymentIntent', CreateUser)
