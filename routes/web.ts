import { route } from '../.stacks/core/router/src/index.ts'
import { request } from '../request.ts'

route.get('/users/list', getBlogs)
// route.post('/blogs', getBlogs)

route.get('/users', getUsers)

route.group({ prefix: '/users' }, () => {
  route.get('/get', getUsers)

  route.get('/delete', getUsers)
})

function getUsers() {
  return 'hello world'
}

// function getUserId() {
//   return request.getParams('id')
// }

function getBlogs() {
  return request.all()
}
