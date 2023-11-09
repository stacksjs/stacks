import { route } from '@stacksjs/router'

// route.group(() => {
//   route.get('/get/:id', getUsers)
//   route.get('/delete', getBlogs)
// }).middleware('auth').prefix('/users')

route.get('/', () => 'hello world 1')
route.get('/api/', () => 'hello world 3')
route.get('/api/welcome', () => 'hello world 4')
route.get('/welcome', () => 'hello world 2')
// route.redirect('/user', '/welcome')

// function getUsers() {
//   return request.getParams('id')
// }

// function getBlogs() {
//   return 'hello blogs function'
// }
