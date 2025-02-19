import { route } from '@stacksjs/router'

route.get('requests', 'storage/framework/actions/src/RequestIndexOrmAction.ts')

route.get('requests/{id}', 'storage/framework/actions/src/RequestShowOrmAction.ts')

route.post('requests', 'storage/framework/actions/src/RequestStoreOrmAction.ts')

route.patch('requests/{id}', 'storage/framework/actions/src/RequestUpdateOrmAction.ts')

route.delete('requests/{id}', 'storage/framework/actions/src/RequestDestroyOrmAction.ts')

route.get('activities', 'storage/framework/actions/src/ActivityIndexOrmAction.ts')

route.get('activities/{id}', 'storage/framework/actions/src/ActivityShowOrmAction.ts')

route.post('activities', 'storage/framework/actions/src/ActivityStoreOrmAction.ts')

route.patch('activities/{id}', 'storage/framework/actions/src/ActivityUpdateOrmAction.ts')

route.delete('activities/{id}', 'storage/framework/actions/src/ActivityDestroyOrmAction.ts')

route.get('users', 'UserIndexOrmAction')

route.post('users', 'UserStoreOrmAction')

route.get('users/{id}', 'UserShowOrmAction')
