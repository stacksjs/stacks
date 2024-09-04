import { route } from '@stacksjs/router'

route.get('users', 'storage/framework/actions/src/UserIndexOrmAction.ts').middleware(['Api'])

route.post('users', 'storage/framework/actions/src/UserStoreOrmAction.ts').middleware(['Api'])
