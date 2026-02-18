import { route } from '@stacksjs/router'


route.get('tags', 'TagIndexOrmAction')

route.post('tags', 'TagStoreOrmAction')

route.get('tags/{id}', 'TagShowOrmAction')

route.patch('tags/{id}', 'TagUpdateOrmAction')

route.delete('tags/{id}', 'TagDestroyOrmAction')

route.get('social-posts', 'SocialPostIndexOrmAction')

route.post('social-posts', 'SocialPostStoreOrmAction')

route.get('social-posts/{id}', 'SocialPostShowOrmAction')

route.patch('social-posts/{id}', 'SocialPostUpdateOrmAction')

route.delete('social-posts/{id}', 'SocialPostDestroyOrmAction')

route.get('campaigns', 'CampaignIndexOrmAction')

route.post('campaigns', 'CampaignStoreOrmAction')

route.get('campaigns/{id}', 'CampaignShowOrmAction')

route.patch('campaigns/{id}', 'CampaignUpdateOrmAction')

route.delete('campaigns/{id}', 'CampaignDestroyOrmAction')

route.get('requests', 'storage/framework/actions/src/RequestIndexOrmAction.ts')

route.get('requests/{id}', 'storage/framework/actions/src/RequestShowOrmAction.ts')

route.post('requests', 'storage/framework/actions/src/RequestStoreOrmAction.ts')

route.patch('requests/{id}', 'storage/framework/actions/src/RequestUpdateOrmAction.ts')

route.delete('requests/{id}', 'storage/framework/actions/src/RequestDestroyOrmAction.ts')

route.get('activities', 'ActivityIndexOrmAction')

route.get('activities/{id}', 'ActivityShowOrmAction')

route.get('email-lists', 'EmailListIndexOrmAction')

route.post('email-lists', 'EmailListStoreOrmAction')

route.get('email-lists/{id}', 'EmailListShowOrmAction')

route.patch('email-lists/{id}', 'EmailListUpdateOrmAction')

route.delete('email-lists/{id}', 'EmailListDestroyOrmAction')

route.get('notifications', 'NotificationIndexOrmAction')

route.post('notifications', 'NotificationStoreOrmAction')

route.get('notifications/{id}', 'NotificationShowOrmAction')

route.patch('notifications/{id}', 'NotificationUpdateOrmAction')

route.delete('notifications/{id}', 'NotificationDestroyOrmAction')

route.get('comments', 'CommentIndexOrmAction')

route.post('comments', 'CommentStoreOrmAction')

route.get('comments/{id}', 'CommentShowOrmAction')

route.patch('comments/{id}', 'CommentUpdateOrmAction')

route.delete('comments/{id}', 'CommentDestroyOrmAction')

route.get('users', 'UserIndexOrmAction')

route.post('users', 'UserStoreOrmAction')

route.get('users/{id}', 'UserShowOrmAction')

route.get('websockets', 'WebsocketIndexOrmAction')

route.post('websockets', 'WebsocketStoreOrmAction')

route.get('websockets/{id}', 'WebsocketShowOrmAction')

route.get('authors', 'AuthorIndexOrmAction')

route.post('authors', 'AuthorStoreOrmAction')

route.get('authors/{id}', 'AuthorShowOrmAction')

route.get('posts', 'PostIndexOrmAction')

route.post('posts', 'PostStoreOrmAction')

route.get('posts/{id}', 'PostShowOrmAction')

route.patch('posts/{id}', 'PostUpdateOrmAction')

route.delete('posts/{id}', 'PostDestroyOrmAction')

