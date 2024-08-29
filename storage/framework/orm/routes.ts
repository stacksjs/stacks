import { route } from '@stacksjs/router'

route.get('users', '../actions/src/UserIndexOrmAction.ts')

route.get('users/{id}', '../actions/src/UserShowOrmAction.ts')

route.post('users', '/Users/glennmichaeltorregosa/Documents/Projects/stacks/app/Actions/UserStoreAction.ts')

route.delete('users/{id}', '../actions/src/UserDestroyOrmAction.ts')
