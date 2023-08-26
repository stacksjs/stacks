import { route } from '../.stacks/core/router/src/index.ts'
import { request } from '../request.ts'

// route.get('/users/list', getBlogs)
// route.post('/blogs', getBlogs)

// route.group({ prefix: '/users', middleware: 'auth' }, () => {
//   route.get('/get/:id', getUsers)

//   // route.get('/delete', getUsers)
// })

// TODO: Add a way to register a view.
route.view('welcome')

function getUsers() {
  return request.getParams('id')
}

// function getUserId() {
//   return request.getParams('id')
// }

function getBlogs() {
  return request.all()
}
