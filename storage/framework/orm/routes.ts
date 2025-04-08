import { route } from '@stacksjs/router'

route.get('users', 'UserIndexOrmAction')

route.post('users', 'UserStoreOrmAction')

route.get('users/{id}', 'UserShowOrmAction')

route.get('requests', 'storage/framework/actions/src/RequestIndexOrmAction.ts')

route.get('requests/{id}', 'storage/framework/actions/src/RequestShowOrmAction.ts')

route.post('requests', 'storage/framework/actions/src/RequestStoreOrmAction.ts')

route.patch('requests/{id}', 'storage/framework/actions/src/RequestUpdateOrmAction.ts')

route.delete('requests/{id}', 'storage/framework/actions/src/RequestDestroyOrmAction.ts')

route.get('logs', 'storage/framework/actions/src/LogIndexOrmAction.ts')

route.get('logs/{id}', 'storage/framework/actions/src/LogShowOrmAction.ts')

route.post('logs', 'storage/framework/actions/src/LogStoreOrmAction.ts')

route.patch('logs/{id}', 'storage/framework/actions/src/LogUpdateOrmAction.ts')

route.delete('logs/{id}', 'storage/framework/actions/src/LogDestroyOrmAction.ts')
