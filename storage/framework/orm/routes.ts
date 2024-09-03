import { route } from '@stacksjs/router'

route.get('users', '[object Object]').middleware(['Api'])

route.get('users/{id}', '[object Object]').middleware(['Api'])

route.post('users', '[object Object]').middleware(['Api'])

route.patch('users/{id}', '[object Object]').middleware(['Api'])

route.delete('users/{id}', '[object Object]').middleware(['Api'])
