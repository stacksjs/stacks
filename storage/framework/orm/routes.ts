import { route } from '@stacksjs/router'


await route.get('subscribers', 'Actions/SubscriberIndexOrmAction').middleware(['auth'])

await route.patch('subscribers/{id}', 'Actions/SubscriberUpdateOrmAction').middleware(['auth'])

await route.post('subscribers', 'Actions/SubscriberStoreOrmAction').middleware(['auth'])

await route.delete('subscribers/{id}', 'Actions/SubscriberDestroyOrmAction').middleware(['auth'])

await route.get('subscribers/{id}', 'Actions/SubscriberShowOrmAction').middleware(['auth'])

await route.get('releases', 'Actions/ReleaseIndexOrmAction').middleware(['auth'])

await route.patch('releases/{id}', 'Actions/ReleaseUpdateOrmAction').middleware(['auth'])

await route.post('releases', 'Actions/ReleaseStoreOrmAction').middleware(['auth'])

await route.delete('releases/{id}', 'Actions/ReleaseDestroyOrmAction').middleware(['auth'])

await route.get('releases/{id}', 'Actions/ReleaseShowOrmAction').middleware(['auth'])

await route.get('users', 'Actions/UserIndexOrmAction').middleware(['auth'])

await route.patch('users/{id}', 'Actions/UserUpdateOrmAction').middleware(['auth'])

await route.post('users', 'Actions/UserStoreOrmAction').middleware(['auth'])

await route.delete('users/{id}', 'Actions/UserDestroyOrmAction').middleware(['auth'])

await route.get('users/{id}', 'Actions/UserShowOrmAction').middleware(['auth'])

