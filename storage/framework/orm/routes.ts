import { route } from '@stacksjs/router'

await route.get('users', 'Actions/UserIndexOrmAction')

await route.patch('users/{id}', 'Actions/UserUpdateOrmAction')

await route.post('users', 'Actions/UserStoreOrmAction')

await route.delete('users/{id}', 'Actions/UserDestroyOrmAction')

await route.get('users/{id}', 'Actions/UserShowOrmAction')
