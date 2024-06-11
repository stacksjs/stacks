import { route } from '@stacksjs/router'


await route.get('subscribers', 'Actions/SubscriberIndexOrmAction').middleware(['Auth'])

await route.patch('subscribers/{id}', 'Actions/SubscriberUpdateOrmAction').middleware(['Auth'])

await route.post('subscribers', 'Actions/SubscriberStoreOrmAction').middleware(['Auth'])

await route.delete('subscribers/{id}', 'Actions/SubscriberDestroyOrmAction').middleware(['Auth'])

await route.get('subscribers/{id}', 'Actions/SubscriberShowOrmAction').middleware(['Auth'])

await route.get('releases', 'Actions/ReleaseIndexOrmAction').middleware(['Auth'])

await route.patch('releases/{id}', 'Actions/ReleaseUpdateOrmAction').middleware(['Auth'])

await route.post('releases', 'Actions/ReleaseStoreOrmAction').middleware(['Auth'])

await route.delete('releases/{id}', 'Actions/ReleaseDestroyOrmAction').middleware(['Auth'])

await route.get('releases/{id}', 'Actions/ReleaseShowOrmAction').middleware(['Auth'])

await route.get('users', 'Actions/UserIndexOrmAction').middleware(['Auth'])

await route.patch('users/{id}', 'Actions/UserUpdateOrmAction').middleware(['Auth'])

await route.post('users', 'Actions/UserStoreOrmAction').middleware(['Auth'])

await route.delete('users/{id}', 'Actions/UserDestroyOrmAction').middleware(['Auth'])

await route.get('users/{id}', 'Actions/UserShowOrmAction').middleware(['Auth'])

th'])

