import { route } from '@stacksjs/router'

await route.get(
  'users',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/orm/Actions/UserIndexOrmAction.ts',
)

await route.get(
  'users/{id}',
  '/Users/glennmichaeltorregosa/Documents/Projects/stacks/storage/framework/orm/Actions/UserShowOrmAction.ts',
)

await route.post('users', '/Users/glennmichaeltorregosa/Documents/Projects/stacks/app/Actions/UserStoreAction.ts')
