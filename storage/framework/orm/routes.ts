import { route } from '@stacksjs/router'

route.get('users', '/Users/chrisbreuer/Code/stacks/storage/framework/actions/UserIndexOrmAction.ts')
route.get('users/{id}', '/Users/chrisbreuer/Code/stacks/storage/framework/actions/UserShowOrmAction.ts')
route.post('users', '/Users/chrisbreuer/Code/stacks/app/Actions/UserStoreAction.ts')
route.delete('users/{id}', '/Users/chrisbreuer/Code/stacks/storage/framework/actions/UserDestroyOrmAction.ts')
