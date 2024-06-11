import { route } from '@stacksjs/router'


await route.get('subscribers', 'Actions/SubscriberIndexOrmAction').middleware(['Api'])

await route.patch('subscribers/{id}', 'Actions/SubscriberUpdateOrmAction').middleware(['Api'])

await route.post('subscribers', 'Actions/SubscriberStoreOrmAction').middleware(['Api'])

await route.delete('subscribers/{id}', 'Actions/SubscriberDestroyOrmAction').middleware(['Api'])

await route.get('subscribers/{id}', 'Actions/SubscriberShowOrmAction').middleware(['Api'])

await route.get('releases', 'Actions/ReleaseIndexOrmAction').middleware(['Api'])

await route.patch('releases/{id}', 'Actions/ReleaseUpdateOrmAction').middleware(['Api'])

await route.post('releases', 'Actions/ReleaseStoreOrmAction').middleware(['Api'])

await route.delete('releases/{id}', 'Actions/ReleaseDestroyOrmAction').middleware(['Api'])

await route.get('releases/{id}', 'Actions/ReleaseShowOrmAction').middleware(['Api'])

await route.get('users', 'Actions/UserIndexOrmAction').middleware(['Api'])

await route.patch('users/{id}', 'Actions/UserUpdateOrmAction').middleware(['Api'])

await route.post('users', 'Actions/UserStoreOrmAction').middleware(['Api'])

await route.delete('users/{id}', 'Actions/UserDestroyOrmAction').middleware(['Api'])

await route.get('users/{id}', 'Actions/UserShowOrmAction').middleware(['Api'])

