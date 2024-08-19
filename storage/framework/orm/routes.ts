import { route } from '@stacksjs/router'

route.get(
  'users',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/actions/src/UserIndexOrmAction.ts',
)

route.get(
  'users/{id}',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/actions/src/UserShowOrmAction.ts',
)

route.post('users', '/Users/glennmichaeltorregosa/Documents/Projects/stacks/app/Actions/UserStoreAction.ts')

route.delete(
  'users/{id}',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/actions/src/UserDestroyOrmAction.ts',
)
