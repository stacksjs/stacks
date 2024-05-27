import { route } from '@stacksjs/router'


await route.get('subscribers', 'Actions/SubscriberIndexOrmAction').middleware(['auth'])

await route.patch('subscribers/{id}', 'Actions/SubscriberUpdateOrmAction').middleware(['auth'])

await route.post('subscribers', 'Actions/SubscriberStoreOrmAction').middleware(['auth'])

await route.delete('subscribers/{id}', 'Actions/SubscriberDestroyOrmAction').middleware(['auth'])

await route.get('subscribers/{id}', 'Actions/SubscriberShowOrmAction').middleware(['auth'])

await route.get('users', 'Actions/UserIndexOrmAction').middleware(['auth'])

await route.patch('users/{id}', 'Actions/UserUpdateOrmAction').middleware(['auth'])

await route.post('users', 'Actions/UserStoreOrmAction').middleware(['auth'])

await route.delete('users/{id}', 'Actions/UserDestroyOrmAction').middleware(['auth'])

await route.get('users/{id}', 'Actions/UserShowOrmAction').middleware(['auth'])

await route.get('subscribers/{id}', 'Actions/SubscriberShowOrmAction').middleware(['auth'])

await route.get('users', 'Actions/UserIndexOrmAction').middleware(['auth'])

await route.patch('users/{id}', 'Actions/UserUpdateOrmAction').middleware(['auth'])

await route.post('users', 'Actions/UserStoreOrmAction').middleware(['auth'])

await route.delete('users/{id}', 'Actions/UserDestroyOrmAction').middleware(['auth'])

await route.get('users/{id}', 'Actions/UserShowOrmAction').middleware(['auth'])

