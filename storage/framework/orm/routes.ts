import { route } from '@stacksjs/router'

route.get('users', 'UserIndexOrmAction').middleware(['Api'])

route.post('users', 'UserStoreOrmAction')

route.get('users/{id}', 'UserShowOrmAction').middleware(['Api'])
