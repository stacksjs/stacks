import { route } from '@stacksjs/router'

route.get('users', 'UserIndexOrmAction').middleware(['Api'])

route.post('users', 'UserStoreOrmAction').middleware(['Api'])
