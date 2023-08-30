import { route } from '../.stacks/core/router/src/index.ts'
import { request } from '../.stacks/core/router/src/request.ts'

route.get('/users/list', getBlogs)
// route.post('/blogs', 'hello world')

// route.group({ prefix: '/users', middleware: 'auth' }, () => {
//   route.get('/get/:id', getUsers)

//   // route.get('/delete', getUsers)
// })

// TODO: Add a way to register a view.
// route.view('/welcome', 'hello world')
route.redirect('/wel', '/welcome')

function getUsers() {
  return request.getParams('id')
}

// function getUserId() {
//   return request.getParams('id')
// }

function getBlogs() {
  return request.all()
}
