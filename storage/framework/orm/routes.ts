import { route } from '@stacksjs/router'

route.get('users', 'storage/framework/actions/src/UserIndexOrmAction.ts').middleware(['Api'])

route.post('users', 'storage/framework/actions/src/UserStoreOrmAction.ts').middleware(['Api'])

route.patch('users/{id}', 'storage/framework/actions/src/UserUpdateOrmAction.ts').middleware(['Api'])

route.delete('users/{id}', 'storage/framework/actions/src/UserDestroyOrmAction.ts').middleware(['Api'])
