import { route } from '@stacksjs/router'

await route.get(
  'users',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/actions/src/UserIndexOrmAction.ts',
)

await route.get(
  'users/{id}',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/actions/src/UserShowOrmAction.ts',
)

await route.post('users', '/Users/glennmichaeltorregosa/Documents/Projects/stacks/app/Actions/UserStoreAction.ts')

await route.delete(
  'users/{id}',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/actions/src/UserDestroyOrmAction.ts',
)
