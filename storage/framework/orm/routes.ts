import { route } from '@stacksjs/router'

await route.get('users', '/Users/chrisbreuer/Code/stacks/storage/framework/orm/Actions/UserIndexOrmAction.ts')

await route.get('users/{id}', '/Users/chrisbreuer/Code/stacks/storage/framework/orm/Actions/UserShowOrmAction.ts')

await route.post('users', '/Users/chrisbreuer/Code/stacks/app/Actions/UserStoreAction.ts')

await route.delete('users/{id}', '/Users/chrisbreuer/Code/stacks/storage/framework/orm/Actions/UserDestroyOrmAction.ts')
