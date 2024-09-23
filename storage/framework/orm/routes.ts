import { route } from '@stacksjs/router'

route.get('users', 'UserIndexOrmAction').middleware(['Api'])

route.post('users', 'UserStoreOrmAction').middleware(['Api'])

route.get('users/{id}', 'UserShowOrmAction').middleware(['Api'])
