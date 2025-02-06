import { route } from '@stacksjs/router'

route.get('activities', 'storage/framework/actions/src/ActivityIndexOrmAction.ts')

route.get('activities/{id}', 'storage/framework/actions/src/ActivityShowOrmAction.ts')

route.post('activities', 'storage/framework/actions/src/ActivityStoreOrmAction.ts')

route.patch('activities/{id}', 'storage/framework/actions/src/ActivityUpdateOrmAction.ts')

route.delete('activities/{id}', 'storage/framework/actions/src/ActivityDestroyOrmAction.ts')

route.get('users', 'UserIndexOrmAction')

route.post('users', 'UserStoreOrmAction')

route.get('users/{id}', 'UserShowOrmAction')
