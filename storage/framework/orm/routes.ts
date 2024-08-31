import { route } from '@stacksjs/router'

route.get('users', 'storage/framework/actions/src/UserIndexOrmAction.ts')

route.get('users/{id}', 'storage/framework/actions/src/UserShowOrmAction.ts')

route.delete('users/{id}', 'storage/framework/actions/src/UserDestroyOrmAction.ts')
