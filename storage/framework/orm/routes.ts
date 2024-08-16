import { route } from '@stacksjs/router'

await route.get('users', '/Users/chrisbreuer/Code/stacks/storage/framework/actions/UserIndexOrmAction.ts')

await route.get('users/{id}', '/Users/chrisbreuer/Code/stacks/storage/framework/actions/UserShowOrmAction.ts')

await route.post('users', '/Users/chrisbreuer/Code/stacks/app/Actions/UserStoreAction.ts')

await route.delete('users/{id}', '/Users/chrisbreuer/Code/stacks/storage/framework/actions/UserDestroyOrmAction.ts')
